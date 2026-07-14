import { GraphAnnotation } from "../graph.js";
import { AIMessage } from "@langchain/core/messages";

export function extractFact() {
    return async (state: GraphAnnotation): Promise<GraphAnnotation> => {
        const received = state.messages.at(-1)!.text;
        return {
            ...state,
            messages: [new AIMessage("ok, processing...")]
        }
    }
}