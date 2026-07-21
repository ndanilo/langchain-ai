import { ConfigModel } from "../config/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, providerStrategy } from "langchain";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
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
                    'HTTP-Referer': 'http://localhost/02-langchain-quiz-generator',
                    'X-Title': '02-langchain-quiz-generator',
                }
            },
        });
    }

    async generateStructuredOutputAsync<T>(
        systemPrompt: string,
        userPrompt: string,
        schema: z.ZodSchema<T>){

        try {
            const agent = createAgent({
                model: this.llmClient,
                tools: [],
                responseFormat: providerStrategy(schema),
            })
    
            const messages = [new SystemMessage(systemPrompt),
                              new HumanMessage(userPrompt)];
    
            const result = await agent.invoke({ messages });
            return {
                success: true,
                data: result.structuredResponse,
                error: null,
            };
        } 
        catch (error) {
            if (error instanceof Error) {
                return {
                    success: false,
                    data: null,
                    error: error.message,
                };
            }
            return {
                success: false,
                data: null,
                error: "An unknown error occurred",
            };
        }
    }
}