import { z } from "zod/v3";
import { withLangGraph } from "@langchain/langgraph/zod";
import { MessagesZodMeta } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const fact = z.object({
    fact: z.string().min(1),
    importance: z.enum(["low", "medium", "high"]),
});

export const question = z.object({
    question: z.string().min(1),
    options: z.array(z.string()).min(1).max(4),
});

/** Root-level questions list used by structured-output questions generation. */
export const questionsSchema = z
    .array(question)
    .min(1).max(10)
    .describe("All questions generated from the facts");

/** Root-level fact list used by structured-output extraction. */
export const factsSchema = z
    .array(fact)
    .min(1)
    .max(10)
    .describe("All distinct atomic facts extracted from the text");

export const graphAnnotation = z.object({
    messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),
    success: z.boolean().default(false),
    errorMessage: z.string().default(""),
    sourceText: z.string().default(""),
    facts: z.array(fact).default(() => []),
    questions: z.array(question).default(() => []),
});

export type Fact = z.infer<typeof fact>;
export type Facts = z.infer<typeof factsSchema>;
export type Questions = z.infer<typeof questionsSchema>;
export type GraphAnnotation = z.infer<typeof graphAnnotation>;
