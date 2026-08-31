import { fakeModel } from "langchain";
import { AIMessage } from "@langchain/core/messages";
import type { FakeBuiltModel } from "@langchain/core/testing";

/** Returns a fake model that replies with a fixed message. */
export function createReplyModel(content: string): FakeBuiltModel {
  return fakeModel().respond(new AIMessage(content));
}

/** Returns a fake model that echoes the last user message back. */
export function createEchoModel(): FakeBuiltModel {
  return fakeModel().respond((messages) => {
    const last = messages.at(-1);
    const text = typeof last?.content === "string" ? last.content : "";
    return new AIMessage(`Echo: ${text}`);
  });
}

/**
 * Returns a fake model that drives one full turn of the agent loop: the first
 * invocation asks for `toolCalls`, the second answers with `finalContent`.
 *
 * Responses are consumed FIFO, one per invocation, which mirrors what a real model
 * does across the model -> tools -> model round trip.
 */
export function createToolCallingModel(
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>,
  finalContent: string,
): FakeBuiltModel {
  return fakeModel()
    .respondWithTools(toolCalls)
    .respond(new AIMessage(finalContent));
}

/**
 * Returns a fake model that answers with JSON, which is what `providerStrategy` parses
 * into `structuredResponse`.
 */
export function createStructuredModel(data: unknown): FakeBuiltModel {
  return fakeModel().respond(new AIMessage(JSON.stringify(data)));
}
