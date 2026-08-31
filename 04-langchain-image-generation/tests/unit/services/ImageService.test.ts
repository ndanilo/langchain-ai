import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ImageService, type FetchLike } from "../../../src/services/ImageService.js";
import { ImageConfig } from "../../../src/config/config.js";

const PIXELS = Buffer.from("fake-image-bytes");

type Call = { url: string; init: RequestInit };

/** Records what the service sent and replays canned responses, one per call. */
function stubFetch(responses: Response[]): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  let index = 0;

  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      const response = responses[index] ?? responses.at(-1)!;
      index += 1;
      return response;
    },
  };
}

function imageResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      created: 1748372400,
      data: [{ b64_json: PIXELS.toString("base64"), media_type: "image/png" }],
      usage: { cost: 0.04 },
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("ImageService", () => {
  it("decodes the base64 payload into bytes and reports the cost", async () => {
    const { fetch } = stubFetch([imageResponse()]);

    const image = await new ImageService(fetch).generateAsync("a poster");

    assert.deepEqual(image.bytes, PIXELS);
    assert.equal(image.mediaType, "image/png");
    assert.equal(image.costUsd, 0.04);
  });

  it("posts the prompt and the configured image settings to /images", async () => {
    const { fetch, calls } = stubFetch([imageResponse()]);

    await new ImageService(fetch).generateAsync("a poster");

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `${ImageConfig.apiHost}/images`);
    assert.equal(calls[0]!.init.method, "POST");

    const body = JSON.parse(calls[0]!.init.body as string);
    assert.equal(body.prompt, "a poster");
    assert.equal(body.model, ImageConfig.model);
    assert.equal(body.aspect_ratio, ImageConfig.aspectRatio);
    assert.equal(body.resolution, ImageConfig.resolution);
    assert.equal(body.output_format, ImageConfig.outputFormat);
  });

  it("authenticates with the image key rather than the chat key", async () => {
    const { fetch, calls } = stubFetch([imageResponse()]);

    await new ImageService(fetch).generateAsync("a poster");

    const headers = calls[0]!.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Bearer ${ImageConfig.apiKey}`);
  });

  it("surfaces the provider's message and does not retry a rejected prompt", async () => {
    const { fetch, calls } = stubFetch([
      new Response(JSON.stringify({ error: { message: "Prompt violates policy" } }), {
        status: 400,
      }),
    ]);

    await assert.rejects(
      () => new ImageService(fetch).generateAsync("a poster"),
      /400 Prompt violates policy/,
    );

    // Billing is per attempt, so a deterministic failure must cost exactly one.
    assert.equal(calls.length, 1);
  });

  it("retries a rate limit and returns the image from the retry", async () => {
    const { fetch, calls } = stubFetch([
      new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), { status: 429 }),
      imageResponse(),
    ]);

    const image = await new ImageService(fetch).generateAsync("a poster");

    assert.deepEqual(image.bytes, PIXELS);
    assert.equal(calls.length, 2);
  });

  it("explains the likely cause when a model returns no image", async () => {
    const { fetch } = stubFetch([imageResponse({ data: [] })]);

    await assert.rejects(
      () => new ImageService(fetch).generateAsync("a poster"),
      /output modalities/,
    );
  });

  it("falls back to the configured format when the provider omits a media type", async () => {
    const { fetch } = stubFetch([
      imageResponse({ data: [{ b64_json: PIXELS.toString("base64") }] }),
    ]);

    const image = await new ImageService(fetch).generateAsync("a poster");

    assert.equal(image.mediaType, `image/${ImageConfig.outputFormat}`);
  });
});
