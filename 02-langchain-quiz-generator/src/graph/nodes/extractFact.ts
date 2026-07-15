import { AIMessage } from "@langchain/core/messages";
import { generateSystemPrompt } from "../prompts/prompts.js";
import { LLMService } from "../../services/LLMService.js";
import {
    factsSchema,
    type Fact,
    type GraphAnnotation,
} from "../schemas.js";

const llmService = new LLMService();

export function extractFact() {
    return async (state: GraphAnnotation): Promise<GraphAnnotation> => {
        const systemPrompt = generateSystemPrompt();
        const userPrompt = state.messages.at(-1)!.text;

        const result = await llmService.generateStructuredOutputAsync<Fact[]>(
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
