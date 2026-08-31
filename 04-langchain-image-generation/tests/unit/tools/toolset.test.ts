import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAllTools, createResearchTools } from "../../../src/tools/index.js";
import type { AgentTool } from "../../../src/services/LLMService.js";

/*
Constructing the Tavily tools does not call the API, so these run offline. They exist to
catch the boring-but-fatal mistakes: a duplicate tool name, a missing description, or a
tool that no longer satisfies what createAgent accepts.
*/
describe("toolset", () => {
  it("exposes the lean research set: date, search, extract", () => {
    const tools: AgentTool[] = createResearchTools();

    assert.deepEqual(tools.map((t) => t.name), [
      "get_current_datetime",
      "web_search",
      "web_extract",
    ]);
  });

  it("adds the whole-site tools in the full set", () => {
    const tools: AgentTool[] = createAllTools();

    assert.deepEqual(tools.map((t) => t.name), [
      "get_current_datetime",
      "web_search",
      "web_extract",
      "web_map",
      "web_crawl",
    ]);
  });

  it("gives every tool a unique snake_case name and a description", () => {
    const tools = createAllTools();
    const names = tools.map((t) => t.name);

    assert.equal(new Set(names).size, names.length, "tool names must be unique");

    for (const t of tools) {
      assert.match(t.name, /^[a-z][a-z0-9_]*$/, `${t.name} should be snake_case`);
      assert.ok(t.description && t.description.length > 20, `${t.name} needs a real description`);
    }
  });
});
