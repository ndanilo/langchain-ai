import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeModel } from "langchain";
import { AIMessage } from "@langchain/core/messages";
import { LLMService } from "../../../src/services/LLMService.js";
import { createReplyModel } from "../../helpers/fake-llm.js";

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
});
