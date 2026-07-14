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
