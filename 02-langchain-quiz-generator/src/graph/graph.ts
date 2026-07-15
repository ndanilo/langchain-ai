import { StateGraph, START, END } from "@langchain/langgraph";
import { extractFact } from "./nodes/extractFact.js";
import { graphAnnotation } from "./schemas.js";

const workflow = new StateGraph({
    stateSchema: graphAnnotation,
})
    .addNode("extractFact", extractFact())
    .addEdge(START, "extractFact")
    .addEdge("extractFact", END);

export const graph = workflow.compile();
