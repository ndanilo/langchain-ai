import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateFactsSystemPrompt,
  generateQuestionsSystemPrompt,
  generateQuestionsUserPrompt,
} from "../../../src/graph/prompts/prompts.js";

describe("generateFactsSystemPrompt", () => {
  it("returns valid JSON with a role and instructions", () => {
    const raw = generateFactsSystemPrompt();
    const parsed = JSON.parse(raw) as {
      role: string;
      instructions: string[];
    };

    assert.equal(typeof parsed.role, "string");
    assert.ok(parsed.role.length > 0);
    assert.ok(Array.isArray(parsed.instructions));
    assert.ok(parsed.instructions.length >= 1);
  });

  it("asks for multiple distinct facts within the 5–10 range", () => {
    const raw = generateFactsSystemPrompt();
    const joined = raw.toLowerCase();

    assert.match(joined, /5 and 10|between 5/);
    assert.match(joined, /distinct|separate/);
    assert.match(joined, /do not summarize|separate item/);
  });
});

describe("generateQuestionsSystemPrompt", () => {
  it("returns valid JSON with a role and instructions", () => {
    const raw = generateQuestionsSystemPrompt();
    const parsed = JSON.parse(raw) as {
      role: string;
      instructions: string[];
    };

    assert.equal(typeof parsed.role, "string");
    assert.ok(parsed.role.length > 0);
    assert.ok(Array.isArray(parsed.instructions));
    assert.ok(parsed.instructions.length >= 1);
  });

  it("asks for multiple-choice questions grounded in facts", () => {
    const raw = generateQuestionsSystemPrompt();
    const joined = raw.toLowerCase();

    assert.match(joined, /facts/);
    assert.match(joined, /sourcetext|source text/);
    assert.match(joined, /4 options|multiple-choice|multiple choice/);
    assert.match(joined, /1 and 10|between 1/);
  });
});

describe("generateQuestionsUserPrompt", () => {
  it("embeds facts and source text in the user prompt", () => {
    const facts = [
      { fact: "48 teams compete.", importance: "high" },
      { fact: "Three host nations.", importance: "medium" },
    ];
    const sourceText = "World Cup article text";

    const parsed = JSON.parse(
      generateQuestionsUserPrompt(facts, sourceText),
    ) as {
      task: string;
      facts: typeof facts;
      sourceText: string;
    };

    assert.equal(typeof parsed.task, "string");
    assert.deepEqual(parsed.facts, facts);
    assert.equal(parsed.sourceText, sourceText);
  });
});
