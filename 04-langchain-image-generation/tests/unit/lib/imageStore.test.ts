import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { basename } from "node:path";
import {
  outputDirectory,
  saveInfographicAsync,
  slugify,
  timestampFor,
} from "../../../src/lib/imageStore.js";
import { createBrief } from "../../helpers/fixtures.js";

describe("slugify", () => {
  it("strips Portuguese accents to their base letters", () => {
    assert.equal(slugify("Inflação em queda"), "inflacao-em-queda");
    assert.equal(slugify("Eleições e opinião"), "eleicoes-e-opiniao");
  });

  it("collapses punctuation and trims stray separators", () => {
    assert.equal(slugify("  R$ 5,18 — dólar hoje!  "), "r-5-18-dolar-hoje");
  });

  it("caps the length without leaving a trailing dash", () => {
    const slug = slugify("a".repeat(200));

    assert.equal(slug.length, 60);
    assert.doesNotMatch(slug, /-$/);
  });

  it("falls back to a usable name when nothing survives", () => {
    assert.equal(slugify("!!! ???"), "infographic");
  });
});

describe("timestampFor", () => {
  it("produces a filename-safe timestamp, since Windows rejects colons", () => {
    const stamp = timestampFor(new Date("2026-08-31T14:05:33.123Z"));

    assert.equal(stamp, "2026-08-31T14-05-33");
    assert.doesNotMatch(stamp, /[:.]/);
  });
});

describe("saveInfographicAsync", () => {
  after(() => rm(outputDirectory(), { recursive: true, force: true }));

  const image = {
    bytes: Buffer.from("fake-image-bytes"),
    mediaType: "image/png",
    costUsd: 0.04,
  };

  const record = {
    question: "Como está a inflação?",
    answer: "A inflação acumulada é de 4,2%.",
    imagePrompt: "a poster",
    brief: createBrief(),
    sources: ["https://example.com/ipca"],
    truncated: false,
  };

  it("writes the image and a sidecar named after the brief title", async () => {
    const saved = await saveInfographicAsync(image, record, new Date("2026-08-31T14:05:33Z"));

    assert.equal(basename(saved.imagePath), "2026-08-31T14-05-33-inflacao-em-queda.png");
    assert.equal(basename(saved.metadataPath), "2026-08-31T14-05-33-inflacao-em-queda.json");

    assert.deepEqual(await readFile(saved.imagePath), image.bytes);
  });

  it("records the prompt, sources and cost so a folder of posters stays readable", async () => {
    const saved = await saveInfographicAsync(image, record, new Date("2026-08-31T15:00:00Z"));
    const metadata = JSON.parse(await readFile(saved.metadataPath, "utf8"));

    assert.equal(metadata.question, record.question);
    assert.equal(metadata.imagePrompt, record.imagePrompt);
    assert.deepEqual(metadata.sources, record.sources);
    assert.equal(metadata.costUsd, 0.04);
    assert.equal(metadata.researchTruncated, false);
    assert.deepEqual(metadata.brief, record.brief);
  });

  it("takes the extension from the provider's media type", async () => {
    const saved = await saveInfographicAsync(
      { ...image, mediaType: "image/jpeg" },
      record,
      new Date("2026-08-31T16:00:00Z"),
    );

    assert.match(saved.imagePath, /\.jpg$/);
  });
});
