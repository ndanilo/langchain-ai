import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeModel } from "langchain";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { LLMService } from "../../../src/services/LLMService.js";
import { extractFact } from "../../../src/graph/nodes/extractFact.js";
import type { Facts, GraphAnnotation } from "../../../src/graph/schemas.js";

function createFactsModel(data: Facts) {
  return fakeModel().respond(new AIMessage(JSON.stringify(data)));
}

function createState(text: string): GraphAnnotation {
  return {
    messages: [new HumanMessage(text)],
    success: false,
    errorMessage: "",
    sourceText: "",
    facts: [],
    questions: [],
  };
}

describe("extractFact", () => {
  it("stores extracted facts on graph state", async () => {
    const facts: Facts = [
      { fact: "48 teams compete.", importance: "high" },
      { fact: "Three host nations.", importance: "high" },
    ];
    const model = createFactsModel(facts);
    const node = extractFact(new LLMService(model));

    const next = await node(createState("World Cup article text"));

    assert.equal(next.success, true);
    assert.equal(next.sourceText, "World Cup article text");
    assert.deepEqual(next.facts, facts);
    assert.equal(model.callCount, 1);
  });

  it("returns an error on graph state when the LLM fails", async () => {
    const model = fakeModel().respond(new Error("upstream timeout"));
    const node = extractFact(new LLMService(model));

    const next = await node(createState("World Cup article text"));

    assert.equal(next.success, false);
    assert.equal(next.errorMessage, "upstream timeout");
  });
});
