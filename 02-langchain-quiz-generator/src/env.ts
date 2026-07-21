import { config } from "dotenv";
import { z, prettifyError } from "zod";

config();

/*
Zod env variables schema set up
*/

// treat empty strings as undefined
const optionalString = z.string().optional()
.transform((val) => (val?.trim() ? val?.trim() : undefined));

// parse "true" and "false" as booleans from .env
const optionalBoolean = z.enum(["true", "false"]).optional()
.transform((val) => val === "true" );

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"])
    .default("development"),

    OPENAI_ROUTER_API_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    LANGCHAIN_TRACING_V2: optionalBoolean.default(false),
    LANGCHAIN_API_KEY: optionalString,
    LANGCHAIN_PROJECT: z.string().min(1).default("02-langchain-quiz-generator"),
    LANGSMITH_API_KEY: optionalString,
    LANGSMITH_TRACING: optionalBoolean.default(false),
});

function parseEnv() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error(prettifyError(parsed.error));
        process.exit(1);
    }

    return parsed.data;
}

export const env = parseEnv();

/** Use when a specific key is required at runtime */
export function requireEnv<K extends keyof typeof env>(
    key: K,
  ): NonNullable<(typeof env)[K]> {
    const value = env[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required environment variable: ${String(key)}`);
    }
    return value as NonNullable<(typeof env)[K]>;
  }