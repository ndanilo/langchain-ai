import { AIMessage } from "@langchain/core/messages";
import { generateQuestionsSystemPrompt, generateQuestionsUserPrompt } from "../prompts/prompts.js";
import { LLMService } from "../../services/LLMService.js";

import {
    questionsSchema,
    type Questions,
    type GraphAnnotation,
} from "../schemas.js";

const defaultLlmService = new LLMService();

export function generateQuestions(llmService: LLMService = defaultLlmService) {
    return async (state: GraphAnnotation): Promise<Partial<GraphAnnotation>> => {

        if (!state.success || !state.facts.length) {
            const errorMessage =
                state.errorMessage || "No facts to generate questions from";
            return {
                ...state,
                success: false,
                errorMessage: errorMessage,
                messages: [new AIMessage(errorMessage)],
            };
        }

        const systemPrompt = generateQuestionsSystemPrompt();
        const userPrompt = generateQuestionsUserPrompt(state.facts, state.sourceText);

        const result = await llmService.generateStructuredOutputAsync<Questions>(
            systemPrompt,
            userPrompt,
            questionsSchema,
        );

        if (!result.success) {
            return {
                ...state,
                success: false,
                errorMessage: `${result.error ?? "Unknown error"}`,
                messages: [new AIMessage(`error: ${result.error ?? "Unknown error"}`)],
            };
        }

        return {
            ...state,
            questions: result.data,
            success: true,
            messages: [new AIMessage(JSON.stringify(result.data))],
        };
    };
}