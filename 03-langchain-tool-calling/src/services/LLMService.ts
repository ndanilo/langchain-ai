import { ConfigModel } from "../config/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, toolCallLimitMiddleware } from "langchain";
import { GraphRecursionError } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import { createResearchTools } from "../tools/index.js";

export type AgentTool = ClientTool | ServerTool;

/*
Two stages, two jobs, two temperatures.

Stage 1 researches: it calls tools in a loop and produces accurate but dry notes.
Stage 2 presents: it sees only what stage 1 gathered and writes the answer a person
actually reads. Splitting them means the writing step cannot invent a tool call and the
research step cannot be pushed off-facts by a warmer sampling setting.
*/

const RESEARCH_PROMPT = `You are a research assistant with live web access.

You do not know today's date and your training data is stale, so for any question about
current facts, prices, news or recent events:
1. Call get_current_datetime first so you know what "now" means.
2. Call web_search to find sources. Put the current year in the query when it matters.
3. If a snippet is too thin to answer, call web_extract on the most promising URL.
4. Answer only from what the tools returned. If they disagree or come back empty, say so
   instead of filling the gap from memory.

Budget: at most two searches and two extracts. Never repeat a search you have already run
with different wording, a different language, or a narrower date — if the first results did
not contain the exact figure, they will not on the fourth attempt either. Approximate
answers with an honest caveat ("around 5.18, and sources vary by a few cents") are correct
and useful; silence is not. Stop and answer as soon as you can say something true.

Be precise rather than readable: another model turns your notes into prose. Always finish
with the URLs you relied on, and note how fresh the information is.`;

const PRESENTER_PROMPT = `You turn research notes into a short, friendly answer for someone
who just asked a question in a chat.

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
                'HTTP-Referer': 'http://localhost/03-langchain-tool-calling',
                'X-Title': '03-langchain-tool-calling',
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
    /** Truncated raw tool output, so the presenter can quote concrete details. */
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
 * feed the presenter a framework message instead of research.
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

/** Collapses a finished agent run into just what the presenter needs to see. */
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
    /** Model that rewrites the research into the user-facing answer. */
    presenter?: BaseChatModel;
};

export class LLMService {
    private researchModel: BaseChatModel;
    private presenterModel: BaseChatModel;
    private agent: ReturnType<typeof createResearchAgent>;

    constructor(options: LLMServiceOptions = {}) {
        this.researchModel = options.model ?? createChatModel(ConfigModel.researchTemperature);
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

    /** Stage 2: rewrite a finished run into something worth showing a person. */
    async writeFriendlyAnswerAsync(
        question: string,
        research: ResearchResult,
    ): Promise<string> {
        const digest = digestResearch(research.messages);

        const response = await this.presenterModel.invoke([
            new SystemMessage(PRESENTER_PROMPT),
            new HumanMessage(renderDigest(question, digest, research.truncated)),
        ]);

        return asText(response.content);
    }
}
