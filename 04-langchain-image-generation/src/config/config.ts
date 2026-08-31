import { env } from "../env.js";
import { z } from "zod";

const configSchema = z.object({
    provider: z.literal("openai"),
    apiKey: z.string().min(1),
    apiHost: z.string().min(1),
    model: z.string().min(1),
    temperature: z.number().min(0).max(1),
    maxTokens: z.number().int().positive().optional(),
    /** Per-request ceiling. ChatOpenAI defaults to no timeout, so a provider that
     *  stalls hangs the process forever. */
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
    temperature: 0.7,
    maxTokens: undefined,
    requestTimeoutMs: 60_000,
    maxRetries: 2,
});
