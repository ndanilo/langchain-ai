import { env } from "../env.js";
import { z } from "zod";

const configSchema = z.object({
    provider: z.literal("openai"),
    apiKey: z.string().min(1),
    model: z.string().min(1),
    temperature: z.number().min(0).max(1),
    maxTokens: z.number().int().positive().optional(),
});

export type ConfigModelSchema = z.infer<typeof configSchema>;

export const ConfigModel = configSchema.parse({
    provider: "openai",
    apiKey: env.OPENAI_API_KEY,
    model: "",
    temperature: 0.7,
    maxTokens: undefined,
});
