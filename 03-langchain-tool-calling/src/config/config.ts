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
    /** Stage 2 (presentation). Enough freedom for natural phrasing, not enough to
     *  start embellishing facts the research stage already pinned down. */
    presenterTemperature: z.number().min(0).max(1),
    maxTokens: z.number().int().positive().optional(),
    /** Caps the model -> tools -> model loop so a confused agent cannot spin forever. */
    recursionLimit: z.number().int().positive(),
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
    model: "deepseek/deepseek-v4-flash-0731",
    researchTemperature: 0,
    presenterTemperature: 0.4,
    maxTokens: undefined,
    recursionLimit: 15,
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
