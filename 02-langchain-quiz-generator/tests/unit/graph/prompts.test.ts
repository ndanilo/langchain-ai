import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateFactsSystemPrompt } from "../../../src/graph/prompts/prompts.js";

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
