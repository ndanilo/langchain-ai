import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeModel } from "langchain";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { LLMService } from "../../../src/services/LLMService.js";
import { extractFact } from "../../../src/graph/nodes/extractFact.js";
import type { Facts } from "../../../src/graph/schemas.js";

function createFactsModel(data: Facts) {
  return fakeModel().respond(new AIMessage(JSON.stringify(data)));
}

describe("extractFact", () => {
  it("appends extracted facts as an AI message", async () => {
    const facts: Facts = [
      { fact: "48 teams compete.", importance: "high" },
      { fact: "Three host nations.", importance: "high" },
    ];
    const model = createFactsModel(facts);
    const node = extractFact(new LLMService(model));

    const next = await node({
      messages: [new HumanMessage("World Cup article text")],
    });

    assert.equal(next.messages.length, 1);
    assert.equal(next.messages[0]?.content, JSON.stringify(facts));
    assert.equal(model.callCount, 1);
  });

  it("returns an error AI message when the LLM fails", async () => {
    const model = fakeModel().respond(new Error("upstream timeout"));
    const node = extractFact(new LLMService(model));

    const next = await node({
      messages: [new HumanMessage("World Cup article text")],
    });

    assert.equal(next.messages.length, 1);
    assert.equal(next.messages[0]?.content, "error: upstream timeout");
  });
});
