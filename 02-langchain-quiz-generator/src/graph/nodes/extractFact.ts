import { GraphAnnotation } from "../graph.js";
import { AIMessage } from "@langchain/core/messages";
import { generateSystemPrompt } from "../prompts/prompts.js";
import { LLMService } from "../../services/LLMService.js";
import { fact, type Fact } from "../graph.js";
import { z } from "zod/v3";

const llmService = new LLMService();
const factsSchema = z.array(fact);

export function extractFact() {
    return async (state: GraphAnnotation): Promise<GraphAnnotation> => {
        const systemPrompt = generateSystemPrompt();
        const userPrompt = state.messages.at(-1)!.text;

        const result = await llmService.generateStructuredOutputAsync<Fact[]>(
            systemPrompt,
            userPrompt, 
            factsSchema);

        if (!result.success) {
            return {
                ...state,
                messages: [new AIMessage("error: " + result.error)]
            }
        }

        const facts = JSON.stringify(result.data);

        return {
            ...state,
            messages: [new AIMessage(facts)]
        }
    }
}