import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { formatToolTrace, summariseToolResult } from "../../../src/lib/trace.js";

describe("summariseToolResult", () => {
  it("summarises a Tavily search response by count and host", () => {
    const line = summariseToolResult(
      JSON.stringify({
        query: "usd to brl",
        answer: null,
        images: [],
        results: [
          { url: "https://www.xe.com/currencyconverter", content: "x".repeat(500) },
          { url: "https://finance.yahoo.com/quote/BRL", content: "y".repeat(700) },
        ],
      }),
    );

    assert.equal(line, "2 results, 1.2k chars, xe.com, finance.yahoo.com");
  });

  it("caps the host list and reports the remainder", () => {
    const results = ["a", "b", "c", "d", "e"].map((host) => ({
      url: `https://${host}.com/page`,
    }));

    const line = summariseToolResult(JSON.stringify({ results }));

    assert.match(line, /^5 results, a\.com, b\.com, c\.com \+2 more$/);
  });

  it("counts raw_content from an extract response", () => {
    const line = summariseToolResult(
      JSON.stringify({
        results: [{ url: "https://example.com/a", raw_content: "z".repeat(2400) }],
      }),
    );

    assert.equal(line, "1 result, 2.4k chars, example.com");
  });

  it("handles a map response whose results are bare URL strings", () => {
    const line = summariseToolResult(
      JSON.stringify({ results: ["https://docs.example.com/a", "https://docs.example.com/b"] }),
    );

    assert.equal(line, "2 results, docs.example.com");
  });

  it("surfaces a tool error instead of the payload", () => {
    const line = summariseToolResult(JSON.stringify({ error: "Error 401: unauthorized" }));

    assert.equal(line, "error: Error 401: unauthorized");
  });

  it("shows small structured returns inline", () => {
    const line = summariseToolResult(JSON.stringify({ iso: "2026-08-31T05:00:00.000Z", timeZone: "UTC" }));

    assert.match(line, /2026-08-31T05:00:00\.000Z/);
  });

  it("falls back to flattened text for non-JSON output", () => {
    const line = summariseToolResult("Unknown time zone\n  \"Mars/Olympus_Mons\".");

    assert.equal(line, 'Unknown time zone "Mars/Olympus_Mons".');
  });
});

describe("formatToolTrace", () => {
  it("emits one arrow line per tool call and per result", () => {
    const lines = formatToolTrace([
      new HumanMessage("How many BRL per USD?"),
      new AIMessage({
        content: "",
        tool_calls: [{ name: "web_search", args: { query: "usd brl" }, id: "call_1" }],
      }),
      new ToolMessage({
        content: JSON.stringify({ results: [{ url: "https://www.xe.com/x" }] }),
        name: "web_search",
        tool_call_id: "call_1",
      }),
      new AIMessage("1 USD = 5.00 BRL"),
    ]);

    assert.deepEqual(lines, [
      '  -> web_search {"query":"usd brl"}',
      "  <- web_search 1 result, xe.com",
    ]);
  });

  it("returns nothing for a run that used no tools", () => {
    const lines = formatToolTrace([new HumanMessage("Hi"), new AIMessage("Hello.")]);

    assert.deepEqual(lines, []);
  });
});
