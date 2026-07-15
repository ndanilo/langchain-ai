import { z } from "zod/v3";
import { withLangGraph } from "@langchain/langgraph/zod";
import { MessagesZodMeta } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const fact = z.object({
    fact: z.string().min(1),
    importance: z.enum(["low", "medium", "high"]),
});

/** Root-level fact list used by structured-output extraction. */
export const factsSchema = z
    .array(fact)
    .min(1)
    .max(10)
    .describe("All distinct atomic facts extracted from the text");

export const graphAnnotation = z.object({
    messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),
});

export type Fact = z.infer<typeof fact>;
export type Facts = z.infer<typeof factsSchema>;
export type GraphAnnotation = z.infer<typeof graphAnnotation>;
