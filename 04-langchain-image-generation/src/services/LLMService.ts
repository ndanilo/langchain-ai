import { ConfigModel, OutputConfig } from "../config/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, providerStrategy, toolCallLimitMiddleware } from "langchain";
import { GraphRecursionError } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import { createResearchTools } from "../tools/index.js";
import { infographicBriefSchema, normaliseBrief, type InfographicBrief } from "../infographic/schema.js";
import { languageName } from "../infographic/prompt.js";

export type AgentTool = ClientTool | ServerTool;

/*
Three stages, three jobs, three temperatures.

Stage 1 researches: it calls tools in a loop and produces accurate but dry notes.
Stage 2 briefs: it reduces those notes to the handful of figures worth putting on a poster,
as structured data rather than prose.
Stage 3 presents: it writes the answer a person reads in the chat.

Splitting them means the writing steps cannot invent a tool call, and the research step
cannot be pushed off-facts by a warmer sampling setting.
*/

const RESEARCH_PROMPT = `You are a research assistant with live web access. Your notes will
be turned into an infographic, so concrete figures matter more than prose.

You do not know today's date and your training data is stale, so for any question about
current facts, prices, news or recent events:
1. Call get_current_datetime first so you know what "now" means.
2. Call web_search to find sources. Put the current year in the query when it matters.
3. If a snippet is too thin to answer, call web_extract on the most promising URL.
4. Answer only from what the tools returned. If they disagree or come back empty, say so
   instead of filling the gap from memory.

Prioritise things that can be drawn: numbers, percentages, dates, rankings, before/after
comparisons. Always write a figure with its unit and its period, e.g. "12.4% (year to
August 2026)". Note when sources disagree and by how much.

Budget: at most two searches and two extracts. Never repeat a search you have already run
with different wording, a different language, or a narrower date — if the first results did
not contain the exact figure, they will not on the fourth attempt either. Approximate
answers with an honest caveat ("around 5.18, and sources vary by a few cents") are correct
and useful; silence is not. Stop and answer as soon as you can say something true.

Be precise rather than readable: other models turn your notes into prose and into a poster.
Always finish with the URLs you relied on, and note how fresh the information is.`;

function briefPrompt(language: string): string {
    return `You turn research notes into the copy for a single infographic poster.

LANGUAGE: every string you produce is printed on the poster, and the poster is for
${language} readers. Write every field in ${language}, including headings and labels, and
use the number, date and currency conventions of ${language}. The research notes are often
in another language; translate them. Never leave a field in the language of the notes.

Rules:
- Use ONLY figures that appear in the notes. Never invent, round beyond what the notes
  support, extrapolate, or add a statistic from your own knowledge.
- Choose the three or four figures that best answer the question. Leave out the rest: a
  poster with ten numbers on it is unreadable.
- Each panel is one figure, described four ways. For a question about interest rates:
    label:  "Taxa atual"
    figure: "14,00% a.a."
    note:   "Definida pelo Copom em agosto"
    icon:   "a bronze coin balanced on a descending stair of blocks"
  The label never contains the number, and the figure never loses its unit or becomes a
  sentence. Getting these the wrong way round makes the poster unreadable.
- Respect the character limit given for each field. Anything longer is cut before it
  reaches the poster, so a long string loses its ending rather than shrinking to fit.
- Never put a URL, a citation or a source name in any field.
- If the notes are too thin for three figures, still produce three panels and say plainly
  in the affected panel that the figure could not be confirmed.

ART DIRECTION: you are also the designer. \`art\` and every \`icon\` are written in English,
are never printed on the poster, and are the only place you should be imaginative — this is
where a poster stops looking like a generic slide.
- Choose a palette and mood that belong to THIS subject and no other. A card game wants
  arcane violets and molten gold; a public-health story wants something else entirely. Vivid
  and saturated. If you would pick the same colours for an unrelated question, pick again.
- Every icon describes a real object or scene from the subject. "a glowing spellbook
  trailing arcane runes" is right; a trophy, a lightbulb, a clipboard or a bar chart is not,
  no matter what the topic is.`;
}

function presenterPrompt(language: string): string {
    return `You turn research notes into a short, friendly answer for someone who just asked
a question in a chat.

Write the answer in ${language}.

Rules:
- Use ONLY the facts in the notes. Never add anything from your own knowledge, and never
  invent a number, date, name or URL.
- Lead with the direct answer in the first sentence.
- Plain language. No headings, no walls of bullets. Two or three short paragraphs at most.
- Keep any caveat that genuinely matters to the reader: a figure that moves, an
  approximate value, sources that disagree.
- If the notes do not actually answer the question, say so plainly instead of guessing.
- Never mention notes, research, searching, tools, or that you are an AI. Just answer.
- Finish with a short "Sources:" list of the URLs you relied on.`;
}

/** The OpenRouter-backed chat model this project talks to. */
export function createChatModel(temperature: number): BaseChatModel {
    return new ChatOpenAI({
        apiKey: ConfigModel.apiKey,
        modelName: ConfigModel.model,
        temperature,
        maxTokens: ConfigModel.maxTokens,
        timeout: ConfigModel.requestTimeoutMs,
        maxRetries: ConfigModel.maxRetries,
        configuration: {
            baseURL: ConfigModel.apiHost,
            defaultHeaders: {
                'HTTP-Referer': 'http://localhost/04-langchain-image-generation',
                'X-Title': '04-langchain-image-generation',
            }
        },
    });
}

/**
 * Compiles the model + tools + prompt into an agent graph.
 *
 * Exported on its own so the LangGraph dev server can mount the same agent the app
 * uses (see `langgraph.json`) instead of a separate copy that can drift.
 */
export function createResearchAgent(
    model: BaseChatModel = createChatModel(ConfigModel.researchTemperature),
    tools: AgentTool[] = createResearchTools(),
) {
    return createAgent({
        model,
        tools,
        systemPrompt: RESEARCH_PROMPT,
        middleware: [
            // "continue" rejects further tool calls but hands control back to the model
            // so it still writes an answer. "end" cannot be used here because it throws
            // when a step contains several parallel tool calls, which ours routinely do.
            toolCallLimitMiddleware({
                runLimit: ConfigModel.maxToolCallsPerRun,
                exitBehavior: "continue",
            }),
        ],
    });
}

export type ResearchResult = {
    messages: BaseMessage[];
    /** True when the loop was cut short instead of the model deciding it was done. */
    truncated: boolean;
};

export type ResearchDigest = {
    /** The research agent's own answer: already synthesised, just not friendly. */
    findings: string;
    /** Truncated raw tool output, so later stages can quote concrete details. */
    evidence: string[];
    /** Every URL the tools returned, deduplicated. */
    sources: string[];
};

/** Per-tool-result cap. Full pages would crowd out the findings and cost tokens. */
const MAX_EVIDENCE_CHARS = 1200;
const MAX_SOURCES = 10;
const URL_PATTERN = /https?:\/\/[^\s"'<>)\]}]+/g;

function asText(content: unknown): string {
    return typeof content === "string" ? content : JSON.stringify(content);
}

/**
 * The agent's answer, which is the last AI message carrying text.
 *
 * Not simply the last message: when the tool budget blocks a call, the run ends on a
 * ToolMessage reading "Tool call limit exceeded", and treating that as the findings would
 * feed the next stage a framework message instead of research.
 */
function lastAnswer(messages: BaseMessage[]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]!;
        if (!AIMessage.isInstance(message)) continue;

        const text = asText(message.content).trim();
        if (text.length > 0) return text;
    }

    return "";
}

/** True when the agent stopped before writing a final answer. */
function endedWithoutAnswer(messages: BaseMessage[]): boolean {
    const last = messages.at(-1);
    if (!last || !AIMessage.isInstance(last)) return true;

    return asText(last.content).trim().length === 0;
}

/** Collapses a finished agent run into just what the later stages need to see. */
export function digestResearch(messages: BaseMessage[]): ResearchDigest {
    const evidence: string[] = [];
    const sources = new Set<string>();

    for (const message of messages) {
        if (!ToolMessage.isInstance(message)) continue;

        const body = asText(message.content);

        for (const url of body.match(URL_PATTERN) ?? []) {
            sources.add(url.replace(/[.,;]+$/, ""));
        }

        evidence.push(`${message.name ?? "tool"}: ${body.slice(0, MAX_EVIDENCE_CHARS)}`);
    }

    return {
        findings: lastAnswer(messages),
        evidence,
        sources: [...sources].slice(0, MAX_SOURCES),
    };
}

function renderDigest(question: string, digest: ResearchDigest, truncated: boolean): string {
    const sections = [
        `The user asked:\n${question}`,
        `\nWhat the research found:\n${digest.findings}`,
    ];

    if (digest.evidence.length > 0) {
        sections.push(`\nRaw evidence:\n${digest.evidence.join("\n\n")}`);
    }

    if (digest.sources.length > 0) {
        sections.push(`\nSource URLs:\n${digest.sources.join("\n")}`);
    }

    if (truncated) {
        sections.push(
            "\nThe research was cut short before it finished, so these notes may be" +
                " incomplete. Answer with what is here, and tell the reader plainly that" +
                " the figure could not be fully confirmed.",
        );
    }

    return sections.join("\n");
}

export type LLMServiceOptions = {
    /** Model driving the tool-calling research loop. */
    model?: BaseChatModel;
    /** Tools exposed to the research agent. */
    tools?: AgentTool[];
    /** Model that reduces the research to structured infographic copy. */
    briefer?: BaseChatModel;
    /** Model that rewrites the research into the user-facing answer. */
    presenter?: BaseChatModel;
};

export class LLMService {
    private researchModel: BaseChatModel;
    private briefModel: BaseChatModel;
    private presenterModel: BaseChatModel;
    private agent: ReturnType<typeof createResearchAgent>;

    constructor(options: LLMServiceOptions = {}) {
        this.researchModel = options.model ?? createChatModel(ConfigModel.researchTemperature);
        this.briefModel = options.briefer ?? createChatModel(ConfigModel.briefTemperature);
        this.presenterModel = options.presenter ?? createChatModel(ConfigModel.presenterTemperature);

        // The agent is stateless config compiled into a graph, so build it once here
        // rather than on every request.
        this.agent = createResearchAgent(this.researchModel, options.tools ?? createResearchTools());
    }

    /**
     * Stage 1: run the tool-calling loop and return the final agent state.
     *
     * Streamed rather than invoked so callers can report progress while it runs. A
     * research pass takes tens of seconds, and without per-step feedback the process
     * looks dead. `onMessage` fires once per new message, in order.
     */
    async makeAIRequestAsync(
        userPrompt: string,
        onMessage: (message: BaseMessage) => void = () => {},
    ): Promise<ResearchResult> {
        const stream = await this.agent.stream(
            { messages: [new HumanMessage(userPrompt)] },
            { streamMode: "values", recursionLimit: ConfigModel.recursionLimit },
        );

        let messages: BaseMessage[] = [];
        let reported = 0;

        try {
            for await (const state of stream) {
                messages = state.messages;

                for (const message of messages.slice(reported)) {
                    onMessage(message);
                }
                reported = messages.length;
            }
        } catch (error) {
            // Hitting the loop backstop is not a reason to throw away the research we
            // already have. Streaming means `messages` still holds every tool result.
            if (!(error instanceof GraphRecursionError)) throw error;
            return { messages, truncated: true };
        }

        // The tool budget can also end a run mid-loop, without an exception.
        return { messages, truncated: endedWithoutAnswer(messages) };
    }

    /**
     * Stage 2: reduce a finished run to the copy for one poster.
     *
     * Structured rather than free text because the strings come back to us and get drawn
     * verbatim. A schema gives length limits the model must respect and a panel count we
     * can rely on, neither of which survives a prose prompt.
     */
    async writeInfographicBriefAsync(
        question: string,
        research: ResearchResult,
    ): Promise<InfographicBrief> {
        const digest = digestResearch(research.messages);
        const language = languageName(OutputConfig.language);

        const agent = createAgent({
            model: this.briefModel,
            tools: [],
            systemPrompt: briefPrompt(language),
            responseFormat: providerStrategy(infographicBriefSchema),
        });

        const result = await agent.invoke({
            messages: [
                new HumanMessage(
                    // Repeated here because a language instruction that appears only in the
                    // system prompt loses to notes written in another language: the model
                    // copies the notes' language into the fields.
                    `Write every field of the brief in ${language}.\n\n${renderDigest(question, digest, research.truncated)}`,
                ),
            ],
        });

        return normaliseBrief(result.structuredResponse as InfographicBrief);
    }

    /** Stage 3: rewrite a finished run into something worth showing a person. */
    async writeFriendlyAnswerAsync(
        question: string,
        research: ResearchResult,
    ): Promise<string> {
        const digest = digestResearch(research.messages);

        const response = await this.presenterModel.invoke([
            new SystemMessage(presenterPrompt(languageName(OutputConfig.language))),
            new HumanMessage(renderDigest(question, digest, research.truncated)),
        ]);

        return asText(response.content);
    }
}
