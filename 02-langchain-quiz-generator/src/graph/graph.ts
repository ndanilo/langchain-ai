import { StateGraph, START, END } from "@langchain/langgraph";
import { extractFact } from "./nodes/extractFact.js";
import { generateQuestions } from "./nodes/generateQuestions.js";
import { graphAnnotation } from "./schemas.js";

const workflow = new StateGraph({
    stateSchema: graphAnnotation,
})
    .addNode("extractFact", extractFact())
    .addNode("generateQuestions", generateQuestions())
    .addEdge(START, "extractFact")
    .addEdge("extractFact", "generateQuestions")
    .addEdge("generateQuestions", END);

export const graph = workflow.compile();
