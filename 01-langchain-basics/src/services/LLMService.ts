import { ConfigModel } from "../config/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";

export class LLMService {
    private llmClient: ChatOpenAI

    constructor() {
        this.llmClient = new ChatOpenAI({
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