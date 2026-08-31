import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeModel, tool } from "langchain";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { LLMService, digestResearch } from "../../../src/services/LLMService.js";
import { ConfigModel } from "../../../src/config/config.js";
import { BRIEF_LIMITS } from "../../../src/infographic/schema.js";
import {
  createReplyModel,
  createStructuredModel,
  createToolCallingModel,
} from "../../helpers/fake-llm.js";
import { createBrief } from "../../helpers/fixtures.js";

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

  it("reports every message to onMessage, in loop order", async () => {
    const stubSearch = tool(() => "5.00", {
      name: "web_search",
      description: "Stub search used in tests.",
      schema: z.object({ query: z.string() }),
    });

    const model = createToolCallingModel(
      [{ name: "web_search", args: { query: "usd brl" } }],
      "One dollar is five reais.",
    );
    const service = new LLMService({ model, tools: [stubSearch] });

    const seen: string[] = [];
    await service.makeAIRequestAsync("How many BRL per USD?", (message) => {
      seen.push(message.getType());
    });

    // The caller sees the loop unfold rather than one lump at the end, which is what
    // lets the CLI show progress instead of sitting silent for a minute.
    assert.deepEqual(seen, ["human", "ai", "tool", "ai"]);
  });

  it("caps a spiralling agent at the tool budget without throwing", async () => {
    const stubSearch = tool(() => "no exact figure", {
      name: "web_search",
      description: "Stub search used in tests.",
      schema: z.object({ query: z.string() }),
    });

    // A model that never stops asking for tools, which is what a real spiral looks like.
    const model = fakeModel();
    for (let i = 0; i < 60; i += 1) {
      model.respondWithTools([{ name: "web_search", args: { query: `attempt ${i}` } }]);
    }

    const service = new LLMService({ model, tools: [stubSearch] });
    const result = await service.makeAIRequestAsync("something unanswerable");

    const executed = result.messages.filter(
      (m) => ToolMessage.isInstance(m) && m.content === "no exact figure",
    );
    assert.equal(executed.length, ConfigModel.maxToolCallsPerRun);

    // It ended on the budget block rather than an answer, so later stages must be warned.
    assert.equal(result.truncated, true);

    // The research gathered before the cutoff survives, so the poster can still be drawn.
    assert.ok(result.messages.some((m) => ToolMessage.isInstance(m)));
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

  it("skips a trailing framework ToolMessage when picking the findings", () => {
    // What the run looks like when the tool budget cuts it off: the last message is a
    // block notice, not the agent's answer.
    const digest = digestResearch([
      new HumanMessage("How many BRL per USD?"),
      new AIMessage("Around 5.19, sources vary by a few cents."),
      new ToolMessage({
        content: "Tool call limit exceeded. Do not make additional tool calls.",
        name: "web_search",
        tool_call_id: "call_9",
      }),
    ]);

    assert.match(digest.findings, /Around 5\.19/);
    assert.doesNotMatch(digest.findings, /limit exceeded/);
  });

  it("returns empty findings when the agent never answered", () => {
    const digest = digestResearch([
      new HumanMessage("Q"),
      new ToolMessage({ content: "some evidence", name: "web_search", tool_call_id: "c1" }),
    ]);

    assert.equal(digest.findings, "");
    assert.equal(digest.evidence.length, 1);
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

describe("LLMService brief stage", () => {
  it("returns the brief as structured data rather than prose", async () => {
    const brief = createBrief();
    const briefer = createStructuredModel(brief);
    const service = new LLMService({ model: createReplyModel("unused"), briefer });

    const result = await service.writeInfographicBriefAsync("Como está a inflação?", {
      messages: [new AIMessage("IPCA acumulado de 4,2%.")],
      truncated: false,
    });

    assert.deepEqual(result, brief);
    assert.equal(briefer.callCount, 1);
  });

  it("sends the question, findings and sources to the brief model", async () => {
    const briefer = createStructuredModel(createBrief());
    const service = new LLMService({ model: createReplyModel("unused"), briefer });

    await service.writeInfographicBriefAsync("Como está a inflação?", {
      messages: [
        new ToolMessage({
          content: '{"results":[{"url":"https://example.com/ipca"}]}',
          name: "web_search",
          tool_call_id: "call_1",
        }),
        new AIMessage("IPCA acumulado de 4,2%."),
      ],
      truncated: false,
    });

    const prompt = briefer.calls[0]!.messages.at(-1)!.content as string;
    assert.match(prompt, /Como está a inflação\?/);
    assert.match(prompt, /IPCA acumulado de 4,2%\./);
    assert.match(prompt, /https:\/\/example\.com\/ipca/);
  });

  it("tells the brief model which language to write in", async () => {
    const briefer = createStructuredModel(createBrief());
    const service = new LLMService({ model: createReplyModel("unused"), briefer });

    await service.writeInfographicBriefAsync("Q", {
      messages: [new AIMessage("finding")],
      truncated: false,
    });

    // `.text` rather than `.content`: a systemPrompt routed through createAgent arrives
    // as content blocks, not a bare string.
    const system = briefer.calls[0]!.messages[0]!;
    assert.equal(system.getType(), "system");
    assert.match(system.text, /Brazilian Portuguese/);
  });

  it("forbids figures that are not in the notes", async () => {
    const briefer = createStructuredModel(createBrief());
    const service = new LLMService({ model: createReplyModel("unused"), briefer });

    await service.writeInfographicBriefAsync("Q", {
      messages: [new AIMessage("finding")],
      truncated: false,
    });

    const system = briefer.calls[0]!.messages[0]!.text;
    assert.match(system, /Use ONLY figures that appear in the notes/);
  });

  it("warns the brief model when the research was cut short", async () => {
    const briefer = createStructuredModel(createBrief());
    const service = new LLMService({ model: createReplyModel("unused"), briefer });

    await service.writeInfographicBriefAsync("Q", {
      messages: [new AIMessage("partial finding")],
      truncated: true,
    });

    const prompt = briefer.calls[0]!.messages.at(-1)!.content as string;
    assert.match(prompt, /cut short/);
  });

  it("repeats the language in the user message, not only the system prompt", async () => {
    const briefer = createStructuredModel(createBrief());
    const service = new LLMService({ model: createReplyModel("unused"), briefer });

    await service.writeInfographicBriefAsync("Q", {
      messages: [new AIMessage("finding")],
      truncated: false,
    });

    const prompt = briefer.calls[0]!.messages.at(-1)!.content as string;
    assert.match(prompt, /^Write every field of the brief in Brazilian Portuguese\./);
  });

  it("normalises an over-long brief instead of passing it straight through", async () => {
    const briefer = createStructuredModel(
      createBrief({ title: "uma manchete absurdamente longa ".repeat(10) }),
    );
    const service = new LLMService({ model: createReplyModel("unused"), briefer });

    const brief = await service.writeInfographicBriefAsync("Q", {
      messages: [new AIMessage("finding")],
      truncated: false,
    });

    assert.ok(brief.title.length <= BRIEF_LIMITS.title);
    assert.doesNotMatch(brief.title, /\s$/);
  });
});

describe("LLMService presenter stage", () => {
  it("sends the findings, evidence and sources to the presenter model", async () => {
    const presenter = createReplyModel("O dólar está em torno de cinco reais.");
    const service = new LLMService({ model: createReplyModel("unused"), presenter });

    const answer = await service.writeFriendlyAnswerAsync("How many BRL per USD?", {
      messages: [
        new ToolMessage({
          content: '{"results":[{"url":"https://example.com/rates"}]}',
          name: "web_search",
          tool_call_id: "call_1",
        }),
        new AIMessage("1 USD = 5.00 BRL."),
      ],
      truncated: false,
    });

    assert.equal(answer, "O dólar está em torno de cinco reais.");
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
    await service.writeFriendlyAnswerAsync("Hello", research);

    // Each stage hit its own model exactly once: no cross-talk between them.
    assert.equal(model.callCount, 1);
    assert.equal(presenter.callCount, 1);
  });

  it("gives the presenter a system prompt that forbids inventing facts", async () => {
    const presenter = createReplyModel("ok");
    const service = new LLMService({ model: createReplyModel("unused"), presenter });

    await service.writeFriendlyAnswerAsync("Q", {
      messages: [new AIMessage("finding")],
      truncated: false,
    });

    const system = presenter.calls[0]!.messages[0]!;
    assert.equal(system.getType(), "system");
    assert.match(system.content as string, /Use ONLY the facts/);
    assert.match(system.content as string, /Brazilian Portuguese/);
  });

  it("warns the presenter when the research was cut short", async () => {
    const presenter = createReplyModel("ok");
    const service = new LLMService({ model: createReplyModel("unused"), presenter });

    await service.writeFriendlyAnswerAsync("Q", {
      messages: [new AIMessage("partial finding")],
      truncated: true,
    });

    const prompt = presenter.calls[0]!.messages.at(-1)!.content as string;
    assert.match(prompt, /cut short/);
  });

  it("says nothing about truncation on a complete run", async () => {
    const presenter = createReplyModel("ok");
    const service = new LLMService({ model: createReplyModel("unused"), presenter });

    await service.writeFriendlyAnswerAsync("Q", {
      messages: [new AIMessage("finding")],
      truncated: false,
    });

    const prompt = presenter.calls[0]!.messages.at(-1)!.content as string;
    assert.doesNotMatch(prompt, /cut short/);
  });
});
