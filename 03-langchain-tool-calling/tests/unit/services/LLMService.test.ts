import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeModel, tool } from "langchain";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { LLMService } from "../../../src/services/LLMService.js";
import { createReplyModel, createToolCallingModel } from "../../helpers/fake-llm.js";

describe("LLMService", () => {
  it("returns the fake model response without calling OpenRouter", async () => {
    const model = createReplyModel("Mock reply");
    const service = new LLMService(model);

    const result = await service.makeAIRequestAsync("Hello");

    assert.equal(result.messages.at(-1)?.content, "Mock reply");
    assert.equal(model.callCount, 1);
  });

  it("passes the user prompt to the model", async () => {
    const model = createReplyModel("OK");
    const service = new LLMService(model);

    await service.makeAIRequestAsync("What is LangChain?");

    assert.equal(model.callCount, 1);
    const received = model.calls[0]?.messages.at(-1);
    assert.equal(received?.content, "What is LangChain?");
  });

  it("propagates model errors", async () => {
    const model = fakeModel().respond(new Error("rate limit"));
    const service = new LLMService(model);

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
    const service = new LLMService(model, [stubSearch]);

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
    const service = new LLMService(model, [stubSearch]);

    const result = await service.makeAIRequestAsync("Hello");

    assert.equal(model.callCount, 1);
    assert.equal(result.messages.some((m) => ToolMessage.isInstance(m)), false);
  });
});
