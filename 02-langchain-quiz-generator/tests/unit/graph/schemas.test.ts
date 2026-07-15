import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fact, factsSchema } from "../../../src/graph/schemas.js";

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
