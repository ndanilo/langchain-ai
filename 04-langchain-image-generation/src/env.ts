import { config } from "dotenv";
import { z, prettifyError } from "zod";

// quiet: dotenv v17 otherwise prints a banner and a rotating promo tip on every run.
config({ quiet: true });

/*
Zod env variables schema set up
*/

// treat empty strings as undefined
const optionalString = z.string().optional()
.transform((val) => (val?.trim() ? val?.trim() : undefined));

// parse "true" and "false" as booleans from .env
const optionalBoolean = z.enum(["true", "false"]).optional()
.transform((val) => val === "true" );

/** Same trick as optionalString, but falls back to a default instead of undefined. */
const stringWithDefault = (fallback: string) =>
    z.string().optional().transform((val) => (val?.trim() ? val.trim() : fallback));

/** Enum read from .env, where an empty value should mean "use the default". */
const enumWithDefault = <const T extends readonly [string, ...string[]]>(
    values: T,
    fallback: T[number],
) =>
    z.preprocess(
        (val) => (typeof val === "string" && val.trim() ? val.trim() : fallback),
        z.enum(values),
    );

const intWithDefault = (fallback: number) =>
    z.preprocess(
        (val) => (typeof val === "string" && val.trim() ? Number(val) : fallback),
        z.number().int().positive(),
    );

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"])
    .default("development"),

    OPENAI_ROUTER_API_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    TAVILY_API_KEY: optionalString,
    LANGCHAIN_TRACING_V2: optionalBoolean.default(false),
    LANGCHAIN_API_KEY: optionalString,
    LANGCHAIN_PROJECT: z.string().min(1).default("04-langchain-image-generation"),
    LANGSMITH_API_KEY: optionalString,
    LANGSMITH_TRACING: optionalBoolean.default(false),

    /** Chat model that researches and writes. Any OpenRouter slug with tool calling. */
    CHAT_MODEL: stringWithDefault("deepseek/deepseek-v4-flash-0731"),

    /*
    Image generation. Separate key and host from the chat model so the image step can be
    pointed at a different provider without disturbing the research agent — they only
    share defaults because OpenRouter serves both.
    */
    IMAGE_API_KEY: optionalString,
    IMAGE_API_HOST: stringWithDefault("https://openrouter.ai/api/v1"),
    /** Any slug whose output modality is image. See openrouter.ai/models. */
    IMAGE_MODEL: stringWithDefault("bytedance-seed/seedream-4.5"),
    /** Infographics are read top to bottom, so the default is portrait. */
    IMAGE_ASPECT_RATIO: enumWithDefault(
        ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "auto"] as const,
        "9:16",
    ),
    /** Below 2K, small infographic labels come back unreadable. */
    IMAGE_RESOLUTION: enumWithDefault(["512", "1K", "2K", "4K"] as const, "2K"),
    IMAGE_OUTPUT_FORMAT: enumWithDefault(["png", "jpeg", "webp"] as const, "png"),
    /** Optional palette override. Left empty — the default — the writing model picks a
     *  palette for each subject, which is what keeps posters from all looking alike. */
    IMAGE_PALETTE: optionalString,
    /** Rendering at 2K routinely outlasts a chat completion. */
    IMAGE_REQUEST_TIMEOUT_MS: intWithDefault(180_000),
    /** Where generated images land. Git-ignored: these are build output, not source. */
    IMAGE_OUTPUT_DIR: stringWithDefault("generated-images"),

    /** Language for the answer and every label drawn on the infographic. */
    OUTPUT_LANGUAGE: stringWithDefault("pt-BR"),
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
