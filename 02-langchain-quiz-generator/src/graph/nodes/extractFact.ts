import { generateFactsSystemPrompt } from "../prompts/prompts.js";
import { LLMService } from "../../services/LLMService.js";

import {
    factsSchema,
    type Facts,
    type GraphAnnotation,
} from "../schemas.js";

const defaultLlmService = new LLMService();

export function extractFact(llmService: LLMService = defaultLlmService) {
    return async (state: GraphAnnotation): Promise<Partial<GraphAnnotation>> => {
        const systemPrompt = generateFactsSystemPrompt();
        const userPrompt = state.messages.at(-1)!.text;

        const result = await llmService.generateStructuredOutputAsync<Facts>(
            systemPrompt,
            userPrompt,
            factsSchema,
        );

        if (!result.success) {
            return {
                ...state,
                success: false,
                errorMessage: `${result.error ?? "Unknown error"}`,
            };
        }

        return {
            ...state,
            facts: result.data,
            sourceText: userPrompt,
            success: true,
        };
    };
}
