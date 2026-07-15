import { AIMessage } from "@langchain/core/messages";
import { generateSystemPrompt } from "../prompts/prompts.js";
import { LLMService } from "../../services/LLMService.js";

import {
    factsSchema,
    type Facts,
    type GraphAnnotation,
} from "../schemas.js";

const defaultLlmService = new LLMService();

export function extractFact(llmService: LLMService = defaultLlmService) {
    return async (state: GraphAnnotation): Promise<GraphAnnotation> => {
        const systemPrompt = generateSystemPrompt();
        const userPrompt = state.messages.at(-1)!.text;

        const result = await llmService.generateStructuredOutputAsync<Facts>(
            systemPrompt,
            userPrompt,
            factsSchema,
        );

        if (!result.success) {
            return {
                ...state,
                messages: [new AIMessage("error: " + result.error)],
            };
        }

        const facts = JSON.stringify(result.data);

        return {
            ...state,
            messages: [new AIMessage(facts)],
        };
    };
}
