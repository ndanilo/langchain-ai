import { env } from "../env.js";
import { z } from "zod";

const configSchema = z.object({
    provider: z.literal("openai"),
    apiKey: z.string().min(1),
    apiHost: z.string().min(1),
    model: z.string().min(1),
    /** Stage 1 (research). Picking a tool and its arguments is a classification
     *  decision, so randomness only buys wrong tool calls. */
    researchTemperature: z.number().min(0).max(1),
    /** Stage 2 (brief). Chooses which numbers reach the poster and writes the labels,
     *  so it sits near the research end: a warm model here invents a statistic that
     *  then gets drawn in 200pt type. */
    briefTemperature: z.number().min(0).max(1),
    /** Stage 3 (presentation). Enough freedom for natural phrasing, not enough to
     *  start embellishing facts the research stage already pinned down. */
    presenterTemperature: z.number().min(0).max(1),
    maxTokens: z.number().int().positive().optional(),
    /** Backstop on the model -> tools -> model loop. Should stay above what
     *  maxToolCallsPerRun allows, so the tool budget is what stops the agent and it
     *  gets a chance to answer, instead of dying on a GraphRecursionError. */
    recursionLimit: z.number().int().positive(),
    /** Tool calls allowed per question. Without this an agent chasing a number it
     *  cannot pin down will keep rephrasing the same search until it runs out of
     *  loop budget, which takes minutes and returns nothing. */
    maxToolCallsPerRun: z.number().int().positive(),
    /** Per-request ceiling. ChatOpenAI defaults to no timeout, so a provider that
     *  stalls hangs the process forever. OpenRouter latency here is genuinely spiky
     *  (measured 1s to 25s for the same trivial prompt), so this is not optional. */
    requestTimeoutMs: z.number().int().positive(),
    /** Retries per request, on top of the first attempt. */
    maxRetries: z.number().int().min(0),
});

export type ConfigModelSchema = z.infer<typeof configSchema>;

export const ConfigModel = configSchema.parse({
    apiHost: "https://openrouter.ai/api/v1",
    provider: "openai",
    apiKey: env.OPENAI_API_KEY,
    model: env.CHAT_MODEL,
    researchTemperature: 0,
    briefTemperature: 0.2,
    presenterTemperature: 0.4,
    maxTokens: undefined,
    recursionLimit: 30,
    maxToolCallsPerRun: 8,
    requestTimeoutMs: 60_000,
    maxRetries: 2,
});

const tavilyConfigSchema = z.object({
    apiKey: z.string().min(1),
    /** Results per search. Each one costs context, so keep it tight. */
    maxResults: z.number().int().positive().max(20),
    searchDepth: z.enum(["basic", "advanced"]),
    extractDepth: z.enum(["basic", "advanced"]),
    /** Content format requested from extract/crawl. */
    format: z.enum(["markdown", "text"]),
    /** Hops from the start URL when crawling or mapping. */
    maxDepth: z.number().int().positive(),
    /** Hard ceiling on pages fetched by a single crawl/map call. */
    crawlLimit: z.number().int().positive(),
});

export type TavilyConfigSchema = z.infer<typeof tavilyConfigSchema>;

export const TavilyConfig = tavilyConfigSchema.parse({
    apiKey: env.TAVILY_API_KEY,
    maxResults: 5,
    searchDepth: "basic",
    extractDepth: "basic",
    format: "markdown",
    maxDepth: 2,
    crawlLimit: 20,
});

const imageConfigSchema = z.object({
    apiKey: z.string().min(1),
    /** Base URL. `/images` is appended, per the OpenRouter image API. */
    apiHost: z.string().min(1),
    model: z.string().min(1),
    aspectRatio: z.string().min(1),
    resolution: z.enum(["512", "1K", "2K", "4K"]),
    outputFormat: z.enum(["png", "jpeg", "webp"]),
    /** Forces one palette on every poster. Undefined by default, because the writing
     *  model choosing colours per subject is what makes the posters look designed
     *  rather than templated. Set it when you need brand colours. */
    paletteOverride: z.string().min(1).optional(),
    /** One poster per question. The API allows up to 10, but each is billed. */
    imagesPerRun: z.number().int().positive().max(10),
    requestTimeoutMs: z.number().int().positive(),
    /** Retries for transient failures only (429 and 5xx), on top of the first attempt.
     *  A rejected prompt is not retried: the same prompt fails the same way. */
    maxRetries: z.number().int().min(0),
});

export type ImageConfigSchema = z.infer<typeof imageConfigSchema>;

export const ImageConfig = imageConfigSchema.parse({
    // Falls back to the chat key because both default to the same OpenRouter account.
    apiKey: env.IMAGE_API_KEY ?? env.OPENAI_API_KEY,
    apiHost: env.IMAGE_API_HOST,
    model: env.IMAGE_MODEL,
    aspectRatio: env.IMAGE_ASPECT_RATIO,
    resolution: env.IMAGE_RESOLUTION,
    outputFormat: env.IMAGE_OUTPUT_FORMAT,
    paletteOverride: env.IMAGE_PALETTE,
    imagesPerRun: 1,
    requestTimeoutMs: env.IMAGE_REQUEST_TIMEOUT_MS,
    maxRetries: 2,
});

/*
What the run produces, as opposed to how it is produced. Kept apart from ImageConfig so the
writing stages can ask for the output language without importing image-model settings.
*/
const outputConfigSchema = z.object({
    /** BCP-47 tag. Drives the answer, the brief, and every label drawn on the poster. */
    language: z.string().min(1),
    /** Relative to the project root unless an absolute path is given. */
    directory: z.string().min(1),
});

export type OutputConfigSchema = z.infer<typeof outputConfigSchema>;

export const OutputConfig = outputConfigSchema.parse({
    language: env.OUTPUT_LANGUAGE,
    directory: env.IMAGE_OUTPUT_DIR,
});
