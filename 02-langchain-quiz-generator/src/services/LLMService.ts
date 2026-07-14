import { ConfigModel } from "../config/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, providerStrategy } from "langchain";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod/v3";

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

    async generateStructuredOutputAsync<T>(
        systemPrompt: string,
        userPrompt: string,
        schema: z.ZodSchema<T>)
    {
        const agent = createAgent({
            model: this.llmClient,
            tools: [],
            responseFormat: providerStrategy(schema),
        })

        const messages = [new AIMessage(systemPrompt),
                          new HumanMessage(userPrompt)];

        const result = await agent.invoke({ messages });
        return result;
    }
}