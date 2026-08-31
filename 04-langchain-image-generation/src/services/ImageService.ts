import { ImageConfig } from "../config/config.js";

/*
Client for the OpenRouter image API (`POST /api/v1/images`).

Hand-written rather than routed through LangChain because image generation is not a chat
completion: OpenRouter serves it from a dedicated endpoint that takes a prompt and returns
base64 bytes, with no messages, no tools and no streaming to model. A ChatOpenAI wrapper
around it would be more code, not less.

Reference: https://openrouter.ai/docs/api/api-reference/images/generate-an-image
*/

export type GeneratedImage = {
    bytes: Buffer;
    /** MIME type reported by the provider, e.g. `image/png`. */
    mediaType: string;
    /** What the run cost in USD, when the provider reports it. */
    costUsd?: number;
};

/** Injection point for tests: same shape as global `fetch`. */
export type FetchLike = (
    input: string,
    init: RequestInit,
) => Promise<Response>;

type ImageApiResponse = {
    created?: number;
    data?: Array<{ b64_json?: string; media_type?: string }>;
    usage?: { cost?: number };
};

/*
Worth retrying: the request never reached a model, or the provider was briefly unhappy.
A 400 or 403 is not here on purpose — a prompt the provider rejects will be rejected
identically on the second attempt, and image generations are billed per attempt.
*/
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 524]);

const BACKOFF_BASE_MS = 1_000;

function describeFailure(status: number, body: string): string {
    try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        if (parsed.error?.message) return `${status} ${parsed.error.message}`;
    } catch {
        // Providers occasionally return HTML or an empty body on 5xx.
    }

    const flat = body.replace(/\s+/g, " ").trim();
    return flat ? `${status} ${flat.slice(0, 200)}` : `${status}`;
}

export class ImageService {
    private readonly fetchImpl: FetchLike;

    constructor(fetchImpl: FetchLike = (input, init) => fetch(input, init)) {
        this.fetchImpl = fetchImpl;
    }

    /** Sends one prompt and returns the first image the provider produced. */
    async generateAsync(prompt: string): Promise<GeneratedImage> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= ImageConfig.maxRetries; attempt += 1) {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * 2 ** (attempt - 1)));
            }

            const response = await this.postAsync(prompt);

            if (response.ok) return this.readAsync(response);

            const failure = new Error(
                `Image generation failed: ${describeFailure(response.status, await response.text())}`,
            );

            if (!RETRYABLE_STATUS.has(response.status)) throw failure;
            lastError = failure;
        }

        throw lastError ?? new Error("Image generation failed");
    }

    private postAsync(prompt: string): Promise<Response> {
        return this.fetchImpl(`${ImageConfig.apiHost}/images`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${ImageConfig.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost/04-langchain-image-generation",
                "X-Title": "04-langchain-image-generation",
            },
            body: JSON.stringify({
                model: ImageConfig.model,
                prompt,
                n: ImageConfig.imagesPerRun,
                aspect_ratio: ImageConfig.aspectRatio,
                resolution: ImageConfig.resolution,
                output_format: ImageConfig.outputFormat,
            }),
            // Without this a stalled provider hangs the process: 2K renders are slow
            // enough that there is no safe shorter default.
            signal: AbortSignal.timeout(ImageConfig.requestTimeoutMs),
        });
    }

    private async readAsync(response: Response): Promise<GeneratedImage> {
        const payload = (await response.json()) as ImageApiResponse;
        const first = payload.data?.[0];

        if (!first?.b64_json) {
            throw new Error(
                `Image generation returned no image. Check that "${ImageConfig.model}" has image in its output modalities.`,
            );
        }

        return {
            bytes: Buffer.from(first.b64_json, "base64"),
            mediaType: first.media_type ?? `image/${ImageConfig.outputFormat}`,
            costUsd: payload.usage?.cost,
        };
    }
}
