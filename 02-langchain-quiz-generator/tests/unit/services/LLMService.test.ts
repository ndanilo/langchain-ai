import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeModel } from "langchain";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { LLMService } from "../../../src/services/LLMService.js";

const replySchema = z.object({
  reply: z.string(),
});

type Reply = z.infer<typeof replySchema>;

/** Fake models must queue an AIMessage whose content matches the schema JSON. */
function createStructuredModel(data: Reply) {
  return fakeModel().respond(new AIMessage(JSON.stringify(data)));
}

describe("LLMService", () => {
  it("returns the fake structured response without calling OpenRouter", async () => {
    const model = createStructuredModel({ reply: "Mock reply" });
    const service = new LLMService(model);

    const result = await service.generateStructuredOutputAsync<Reply>(
      "You are a helpful assistant.",
      "Hello",
      replySchema,
    );

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { reply: "Mock reply" });
    assert.equal(result.error, null);
    assert.equal(model.callCount, 1);
  });

  it("passes the user prompt to the model", async () => {
    const model = createStructuredModel({ reply: "OK" });
    const service = new LLMService(model);

    await service.generateStructuredOutputAsync<Reply>(
      "You are a helpful assistant.",
      "What is LangChain?",
      replySchema,
    );

    assert.equal(model.callCount, 1);
    const received = model.calls[0]?.messages.find(
      (m) => HumanMessage.isInstance(m),
    );
    assert.equal(received?.content, "What is LangChain?");
  });

  it("returns model errors instead of throwing", async () => {
    const model = fakeModel().respond(new Error("rate limit"));
    const service = new LLMService(model);

    const result = await service.generateStructuredOutputAsync<Reply>(
      "You are a helpful assistant.",
      "Hello",
      replySchema,
    );

    assert.equal(result.success, false);
    assert.equal(result.data, null);
    assert.equal(result.error, "rate limit");
    assert.equal(model.callCount, 1);
  });
});
