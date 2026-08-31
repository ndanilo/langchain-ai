import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { tool } from "langchain";
import { z } from "zod";
import { InfographicPipeline } from "../../src/pipeline.js";
import { LLMService } from "../../src/services/LLMService.js";
import { ImageService, type FetchLike } from "../../src/services/ImageService.js";
import { outputDirectory } from "../../src/lib/imageStore.js";
import {
  createReplyModel,
  createStructuredModel,
  createToolCallingModel,
} from "../helpers/fake-llm.js";
import { createBrief } from "../helpers/fixtures.js";

const PIXELS = Buffer.from("fake-image-bytes");

function stubImages(): { images: ImageService; prompts: string[] } {
  const prompts: string[] = [];

  const fetchImpl: FetchLike = async (_url, init) => {
    prompts.push(JSON.parse(init.body as string).prompt);
    return new Response(
      JSON.stringify({
        created: 1,
        data: [{ b64_json: PIXELS.toString("base64"), media_type: "image/png" }],
        usage: { cost: 0.04 },
      }),
      { status: 200 },
    );
  };

  return { images: new ImageService(fetchImpl), prompts };
}

/** A research model that searches once, so the run has a tool result and a source URL. */
function researchingService() {
  const stubSearch = tool(() => '{"results":[{"url":"https://example.com/ipca"}]}', {
    name: "web_search",
    description: "Stub search used in tests.",
    schema: z.object({ query: z.string() }),
  });

  return new LLMService({
    model: createToolCallingModel(
      [{ name: "web_search", args: { query: "ipca" } }],
      "IPCA acumulado de 4,2% em doze meses.",
    ),
    tools: [stubSearch],
    briefer: createStructuredModel(createBrief()),
    presenter: createReplyModel("A inflação acumulada é de 4,2%."),
  });
}

describe("InfographicPipeline", () => {
  after(() => rm(outputDirectory(), { recursive: true, force: true }));

  it("runs question -> research -> brief -> image -> disk", async () => {
    const { images, prompts } = stubImages();
    const pipeline = new InfographicPipeline(researchingService(), images);

    const run = await pipeline.runAsync("Como está a inflação?");

    assert.equal(run.answer, "A inflação acumulada é de 4,2%.");
    assert.deepEqual(run.brief, createBrief());
    assert.equal(run.costUsd, 0.04);
    assert.ok(run.saved, "the run was saved");
    assert.deepEqual(await readFile(run.saved!.imagePath), PIXELS);

    // The image model was asked for the prompt built from the brief, not the raw answer.
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0], run.imagePrompt);
    assert.match(run.imagePrompt, /Inflação em queda/);
  });

  it("carries the researched sources into the run and the sidecar", async () => {
    const { images } = stubImages();
    const pipeline = new InfographicPipeline(researchingService(), images);

    const run = await pipeline.runAsync("Como está a inflação?");
    const metadata = JSON.parse(await readFile(run.saved!.metadataPath, "utf8"));

    assert.deepEqual(run.sources, ["https://example.com/ipca"]);
    assert.deepEqual(metadata.sources, ["https://example.com/ipca"]);
    assert.equal(metadata.question, "Como está a inflação?");
  });

  it("reports each stage so a caller can show progress", async () => {
    const { images } = stubImages();
    const pipeline = new InfographicPipeline(researchingService(), images);

    const stages: string[] = [];
    await pipeline.runAsync("Como está a inflação?", { onStage: (s) => stages.push(s) });

    assert.deepEqual(stages, [
      "researching",
      "writing answer and brief",
      "drawing 2K infographic",
      "saving",
    ]);
  });

  it("streams research messages to the caller in loop order", async () => {
    const { images } = stubImages();
    const pipeline = new InfographicPipeline(researchingService(), images);

    const types: string[] = [];
    await pipeline.runAsync("Como está a inflação?", {
      onMessage: (message) => types.push(message.getType()),
    });

    assert.deepEqual(types, ["human", "ai", "tool", "ai"]);
  });

  it("stops before the image model on a dry run, so nothing is billed", async () => {
    const { images, prompts } = stubImages();
    const pipeline = new InfographicPipeline(researchingService(), images);

    const run = await pipeline.runAsync("Como está a inflação?", {}, { dryRun: true });

    assert.equal(prompts.length, 0, "the image API was not called");
    assert.equal(run.saved, undefined);
    assert.ok(run.imagePrompt.length > 0, "the prompt is still available to inspect");
  });
});
