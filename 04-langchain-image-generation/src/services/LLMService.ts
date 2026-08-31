import { ConfigModel } from "../config/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

/** The OpenRouter-backed chat model this project talks to. */
export function createChatModel(temperature: number = ConfigModel.temperature): BaseChatModel {
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
                "HTTP-Referer": "http://localhost/04-langchain-image-generation",
                "X-Title": "04-langchain-image-generation",
            },
        },
    });
}

export class LLMService {
    private llmClient: BaseChatModel;

    constructor(model?: BaseChatModel) {
        this.llmClient = model ?? createChatModel();
    }

    async makeAIRequestAsync(userPrompt: string) {
        const agent = createAgent({
            model: this.llmClient,
            tools: [],
        });

        const messages = [new HumanMessage(userPrompt)];

        return agent.invoke({ messages });
    }
}
