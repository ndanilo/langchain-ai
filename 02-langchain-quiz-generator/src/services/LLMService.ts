import { ConfigModel } from "../config/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export class LLMService {
    private llmClient: BaseChatModel;

    constructor(model?: BaseChatModel) {
        this.llmClient = model ?? new ChatOpenAI({
            apiKey: ConfigModel.apiKey,
            modelName: ConfigModel.model,
            temperature: ConfigModel.temperature,
            maxTokens: ConfigModel.maxTokens,
            configuration: {
                baseURL: ConfigModel.apiHost,
                defaultHeaders: {
                    'HTTP-Referer': 'http://localhost/01-langchain-basics',
                    'X-Title': '01-langchain-basics',
                }
            },
        });
    }

    async makeAIRequestAsync(userPrompt: string) 
    {
        const agent = createAgent({
            model: this.llmClient,
            tools: [],
        })

        const messages = [new HumanMessage(userPrompt)];

        const result = await agent.invoke({ messages });
        return result;
    }
}