import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeModel } from "langchain";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { LLMService } from "../../../src/services/LLMService.js";
import { generateQuestions } from "../../../src/graph/nodes/generateQuestions.js";
import type {
  Facts,
  GraphAnnotation,
  Questions,
} from "../../../src/graph/schemas.js";

function createQuestionsModel(data: Questions) {
  return fakeModel().respond(new AIMessage(JSON.stringify(data)));
}

function createState(
  overrides: Partial<GraphAnnotation> = {},
): GraphAnnotation {
  return {
    messages: [new HumanMessage("World Cup article text")],
    success: true,
    errorMessage: "",
    sourceText: "World Cup article text",
    facts: [
      { fact: "48 teams compete.", importance: "high" },
      { fact: "Three host nations.", importance: "high" },
    ] satisfies Facts,
    questions: [],
    ...overrides,
  };
}

describe("generateQuestions", () => {
  it("stores generated questions on graph state", async () => {
    const questions: Questions = [
      {
        question: "How many teams compete in the 2026 World Cup?",
        options: ["32", "40", "48", "64"],
      },
    ];
    const model = createQuestionsModel(questions);
    const node = generateQuestions(new LLMService(model));

    const next = await node(createState());

    assert.equal(next.success, true);
    assert.deepEqual(next.questions, questions);
    assert.equal(model.callCount, 1);
  });

  it("returns an error AI message when the LLM fails", async () => {
    const model = fakeModel().respond(new Error("upstream timeout"));
    const node = generateQuestions(new LLMService(model));

    const next = await node(createState());

    assert.equal(next.success, false);
    assert.equal(next.errorMessage, "upstream timeout");
    assert.equal(next.messages?.length, 1);
    assert.equal(next.messages?.[0]?.content, "error: upstream timeout");
  });

  it("skips the LLM when prior extraction failed", async () => {
    const model = createQuestionsModel([
      {
        question: "Should not be called",
        options: ["a", "b", "c", "d"],
      },
    ]);
    const node = generateQuestions(new LLMService(model));

    const next = await node(
      createState({
        success: false,
        errorMessage: "extract failed",
        facts: [],
      }),
    );

    assert.equal(next.success, false);
    assert.equal(next.errorMessage, "extract failed");
    assert.equal(next.messages?.[0]?.content, "extract failed");
    assert.equal(model.callCount, 0);
  });

  it("skips the LLM when there are no facts", async () => {
    const model = createQuestionsModel([
      {
        question: "Should not be called",
        options: ["a", "b", "c", "d"],
      },
    ]);
    const node = generateQuestions(new LLMService(model));

    const next = await node(
      createState({
        success: true,
        facts: [],
        errorMessage: "",
      }),
    );

    assert.equal(next.success, false);
    assert.equal(next.errorMessage, "No facts to generate questions from");
    assert.equal(model.callCount, 0);
  });
});
