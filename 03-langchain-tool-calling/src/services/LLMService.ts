import { ConfigModel } from "../config/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import { createResearchTools } from "../tools/index.js";

export type AgentTool = ClientTool | ServerTool;

const SYSTEM_PROMPT = `You are a research assistant with live web access.

You do not know today's date and your training data is stale, so for any question about
current facts, prices, news or recent events:
1. Call get_current_datetime first so you know what "now" means.
2. Call web_search to find sources. Put the current year in the query when it matters.
3. If a snippet is too thin to answer, call web_extract on the most promising URL.
4. Answer only from what the tools returned. If they disagree or come back empty, say so
   instead of filling the gap from memory.

Always finish with the URLs you relied on, and note how fresh the information is.`;

/** The OpenRouter-backed chat model this project talks to. */
export function createChatModel(): BaseChatModel {
    return new ChatOpenAI({
        apiKey: ConfigModel.apiKey,
        modelName: ConfigModel.model,
        temperature: ConfigModel.temperature,
        maxTokens: ConfigModel.maxTokens,
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
    model: BaseChatModel = createChatModel(),
    tools: AgentTool[] = createResearchTools(),
) {
    return createAgent({
        model,
        tools,
        systemPrompt: SYSTEM_PROMPT,
    });
}

export class LLMService {
    private llmClient: BaseChatModel;
    private agent: ReturnType<typeof createResearchAgent>;

    constructor(model?: BaseChatModel, tools?: AgentTool[]) {
        this.llmClient = model ?? createChatModel();

        // The agent is stateless config compiled into a graph, so build it once here
        // rather than on every request.
        this.agent = createResearchAgent(this.llmClient, tools ?? createResearchTools());
    }

    async makeAIRequestAsync(userPrompt: string) 
    {
        const messages = [new HumanMessage(userPrompt)];

        const result = await this.agent.invoke(
            { messages },
            { recursionLimit: ConfigModel.recursionLimit },
        );
        return result;
    }
}
