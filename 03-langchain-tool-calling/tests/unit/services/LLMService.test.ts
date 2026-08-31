import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeModel, tool } from "langchain";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { LLMService, digestResearch } from "../../../src/services/LLMService.js";
import { createReplyModel, createToolCallingModel } from "../../helpers/fake-llm.js";

describe("LLMService research stage", () => {
  it("returns the fake model response without calling OpenRouter", async () => {
    const model = createReplyModel("Mock reply");
    const service = new LLMService({ model });

    const result = await service.makeAIRequestAsync("Hello");

    assert.equal(result.messages.at(-1)?.content, "Mock reply");
    assert.equal(model.callCount, 1);
  });

  it("passes the user prompt to the model", async () => {
    const model = createReplyModel("OK");
    const service = new LLMService({ model });

    await service.makeAIRequestAsync("What is LangChain?");

    assert.equal(model.callCount, 1);
    const received = model.calls[0]?.messages.at(-1);
    assert.equal(received?.content, "What is LangChain?");
  });

  it("propagates model errors", async () => {
    const model = fakeModel().respond(new Error("rate limit"));
    const service = new LLMService({ model });

    await assert.rejects(
      () => service.makeAIRequestAsync("Hello"),
      (err: Error) => {
        assert.equal(err.message, "rate limit");
        return true;
      },
    );
    assert.equal(model.callCount, 1);
  });

  it("executes a requested tool and feeds the result back to the model", async () => {
    const calls: string[] = [];
    const stubSearch = tool(
      ({ query }) => {
        calls.push(query);
        return "1 USD = 5.00 BRL";
      },
      {
        name: "web_search",
        description: "Stub search used in tests.",
        schema: z.object({ query: z.string() }),
      },
    );

    const model = createToolCallingModel(
      [{ name: "web_search", args: { query: "usd to brl" } }],
      "One dollar is five reais.",
    );
    const service = new LLMService({ model, tools: [stubSearch] });

    const result = await service.makeAIRequestAsync("How many BRL per USD?");

    // The tool ran with the arguments the model produced.
    assert.deepEqual(calls, ["usd to brl"]);

    // The loop went model -> tool -> model, so the model was invoked twice.
    assert.equal(model.callCount, 2);

    // The tool output was appended as a ToolMessage before the final answer.
    const toolMessage = result.messages.find((m) => ToolMessage.isInstance(m));
    assert.equal(toolMessage?.content, "1 USD = 5.00 BRL");
    assert.equal(result.messages.at(-1)?.content, "One dollar is five reais.");
  });

  it("does not call any tool when the model answers directly", async () => {
    const stubSearch = tool(() => "should not run", {
      name: "web_search",
      description: "Stub search used in tests.",
      schema: z.object({ query: z.string() }),
    });

    const model = createReplyModel("No lookup needed.");
    const service = new LLMService({ model, tools: [stubSearch] });

    const result = await service.makeAIRequestAsync("Hello");

    assert.equal(model.callCount, 1);
    assert.equal(result.messages.some((m) => ToolMessage.isInstance(m)), false);
  });
});

describe("digestResearch", () => {
  const run = [
    new HumanMessage("How many BRL per USD?"),
    new AIMessage({
      content: "",
      tool_calls: [{ name: "web_search", args: { query: "usd brl" }, id: "call_1" }],
    }),
    new ToolMessage({
      content: '{"results":[{"url":"https://example.com/rates","title":"Rates"}]}',
      name: "web_search",
      tool_call_id: "call_1",
    }),
    new AIMessage("1 USD = 5.00 BRL as of today. Source: https://example.com/rates"),
  ];

  it("takes the findings from the last message", () => {
    const digest = digestResearch(run);

    assert.match(digest.findings, /1 USD = 5\.00 BRL/);
  });

  it("collects tool output as evidence, tagged with the tool name", () => {
    const digest = digestResearch(run);

    assert.equal(digest.evidence.length, 1);
    assert.match(digest.evidence[0]!, /^web_search: /);
  });

  it("pulls source URLs out of tool results without trailing punctuation", () => {
    const digest = digestResearch(run);

    assert.deepEqual(digest.sources, ["https://example.com/rates"]);
  });

  it("returns empty collections for a run that used no tools", () => {
    const digest = digestResearch([
      new HumanMessage("Hi"),
      new AIMessage("Hello."),
    ]);

    assert.equal(digest.findings, "Hello.");
    assert.deepEqual(digest.evidence, []);
    assert.deepEqual(digest.sources, []);
  });
});

describe("LLMService presenter stage", () => {
  it("sends the findings, evidence and sources to the presenter model", async () => {
    const presenter = createReplyModel("A dollar buys about five reais right now.");
    const service = new LLMService({ model: createReplyModel("unused"), presenter });

    const answer = await service.writeFriendlyAnswerAsync("How many BRL per USD?", [
      new ToolMessage({
        content: '{"results":[{"url":"https://example.com/rates"}]}',
        name: "web_search",
        tool_call_id: "call_1",
      }),
      new AIMessage("1 USD = 5.00 BRL."),
    ]);

    assert.equal(answer, "A dollar buys about five reais right now.");
    assert.equal(presenter.callCount, 1);

    const prompt = presenter.calls[0]!.messages.at(-1)!.content as string;
    assert.match(prompt, /How many BRL per USD\?/);
    assert.match(prompt, /1 USD = 5\.00 BRL\./);
    assert.match(prompt, /https:\/\/example\.com\/rates/);
  });

  it("uses a separate model from the research stage", async () => {
    const model = createReplyModel("research answer");
    const presenter = createReplyModel("friendly answer");
    const service = new LLMService({ model, presenter });

    const research = await service.makeAIRequestAsync("Hello");
    await service.writeFriendlyAnswerAsync("Hello", research.messages);

    // Each stage hit its own model exactly once: no cross-talk between them.
    assert.equal(model.callCount, 1);
    assert.equal(presenter.callCount, 1);
  });

  it("gives the presenter a system prompt that forbids inventing facts", async () => {
    const presenter = createReplyModel("ok");
    const service = new LLMService({ model: createReplyModel("unused"), presenter });

    await service.writeFriendlyAnswerAsync("Q", [new AIMessage("finding")]);

    const system = presenter.calls[0]!.messages[0]!;
    assert.equal(system.getType(), "system");
    assert.match(system.content as string, /Use ONLY the facts/);
  });
});
