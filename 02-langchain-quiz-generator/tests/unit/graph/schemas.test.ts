import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fact,
  factsSchema,
  question,
  questionsSchema,
} from "../../../src/graph/schemas.js";

describe("fact schema", () => {
  it("accepts a valid fact", () => {
    const parsed = fact.parse({
      fact: "The 2026 World Cup has 48 teams.",
      importance: "high",
    });

    assert.equal(parsed.importance, "high");
    assert.match(parsed.fact, /48 teams/);
  });

  it("rejects empty fact text", () => {
    assert.throws(() =>
      fact.parse({ fact: "", importance: "medium" }),
    );
  });

  it("rejects invalid importance", () => {
    assert.throws(() =>
      fact.parse({ fact: "Some fact", importance: "critical" }),
    );
  });
});

describe("factsSchema", () => {
  it("accepts a list of 1–10 facts", () => {
    const parsed = factsSchema.parse([
      { fact: "Hosted by three countries.", importance: "high" },
      { fact: "Expanded to 48 teams.", importance: "medium" },
      { fact: "Tournament lasts 39 days.", importance: "low" },
    ]);

    assert.equal(parsed.length, 3);
    assert.equal(parsed[0]?.importance, "high");
  });

  it("rejects an empty list", () => {
    assert.throws(() => factsSchema.parse([]));
  });

  it("rejects more than 10 facts", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      fact: `Fact number ${i + 1}`,
      importance: "low" as const,
    }));

    assert.throws(() => factsSchema.parse(tooMany));
  });

  it("rejects a wrapped object shape", () => {
    assert.throws(() =>
      factsSchema.parse({
        facts: [{ fact: "Only one", importance: "high" }],
      }),
    );
  });
});

describe("question schema", () => {
  it("accepts a valid question with up to 4 options", () => {
    const parsed = question.parse({
      question: "How many teams compete?",
      options: ["32", "40", "48", "64"],
    });

    assert.equal(parsed.options.length, 4);
    assert.match(parsed.question, /teams/);
  });

  it("rejects empty question text", () => {
    assert.throws(() =>
      question.parse({ question: "", options: ["a"] }),
    );
  });

  it("rejects more than 4 options", () => {
    assert.throws(() =>
      question.parse({
        question: "Pick one",
        options: ["a", "b", "c", "d", "e"],
      }),
    );
  });

  it("rejects an empty options list", () => {
    assert.throws(() =>
      question.parse({ question: "Pick one", options: [] }),
    );
  });
});

describe("questionsSchema", () => {
  it("accepts a list of 1–10 questions", () => {
    const parsed = questionsSchema.parse([
      {
        question: "How many host nations?",
        options: ["1", "2", "3", "4"],
      },
      {
        question: "How many teams?",
        options: ["32", "48"],
      },
    ]);

    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.options.length, 4);
  });

  it("rejects an empty list", () => {
    assert.throws(() => questionsSchema.parse([]));
  });

  it("rejects more than 10 questions", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      question: `Question ${i + 1}?`,
      options: ["a", "b", "c", "d"],
    }));

    assert.throws(() => questionsSchema.parse(tooMany));
  });

  it("rejects a wrapped object shape", () => {
    assert.throws(() =>
      questionsSchema.parse({
        questions: [
          { question: "Only one?", options: ["yes", "no"] },
        ],
      }),
    );
  });
});
