import { StateSchema, MessagesValue, MessagesZodMeta, StateGraph, START, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { withLangGraph } from "@langchain/langgraph/zod";
import { BaseMessage } from "@langchain/core/messages";

import { extractFact } from "./nodes/extractFact.js";

export const fact = z.object({
    fact: z.string(),
    importance: z.enum(["low", "medium", "high"]),
});

export const graphAnnotation = z.object({
    messages: withLangGraph(z.custom<BaseMessage[]>(),MessagesZodMeta)
});

export type GraphAnnotation = z.infer<typeof graphAnnotation>;
export type Fact = z.infer<typeof fact>;

const workflow = new StateGraph({
    stateSchema: graphAnnotation
})
.addNode("extractFact", extractFact())
.addEdge(START, "extractFact")
.addEdge("extractFact", END);

export const graph = workflow.compile();