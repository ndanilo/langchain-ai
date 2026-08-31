import type { BaseMessage } from "@langchain/core/messages";
import { ImageConfig, OutputConfig } from "./config/config.js";
import { digestResearch, LLMService } from "./services/LLMService.js";
import { ImageService } from "./services/ImageService.js";
import { renderImagePrompt } from "./infographic/prompt.js";
import type { InfographicBrief } from "./infographic/schema.js";
import { saveInfographicAsync, type SavedInfographic } from "./lib/imageStore.js";

/*
Question in, poster on disk out.

    research (tools, temp 0)
      -> brief (structured, temp 0.2)  \ run together: both read the same finished
      -> answer (prose, temp 0.4)      / research and neither depends on the other
      -> image prompt (plain string building, no model)
      -> image model
      -> disk

Kept out of the CLI so the stages can be tested and reused without a terminal, and so the
CLI is left with argument parsing and printing.
*/

export type PipelineEvents = {
    /** Coarse label for whatever is happening now, for a spinner or a log. */
    onStage?(label: string): void;
    /** Fires once per new message during the research loop, in order. */
    onMessage?(message: BaseMessage): void;
};

export type PipelineOptions = {
    /** Stop after composing the image prompt. Nothing is generated and nothing is billed. */
    dryRun?: boolean;
};

export type InfographicRun = {
    answer: string;
    brief: InfographicBrief;
    imagePrompt: string;
    sources: string[];
    /** True when the research loop was cut short, so the figures are less trustworthy. */
    truncated: boolean;
    /** Absent on a dry run. */
    saved?: SavedInfographic;
    /** Reported by the image provider when available. */
    costUsd?: number;
};

export class InfographicPipeline {
    private llm: LLMService;
    private images: ImageService;

    constructor(llm: LLMService = new LLMService(), images: ImageService = new ImageService()) {
        this.llm = llm;
        this.images = images;
    }

    async runAsync(
        question: string,
        events: PipelineEvents = {},
        options: PipelineOptions = {},
    ): Promise<InfographicRun> {
        const stage = events.onStage ?? (() => {});

        stage("researching");
        const research = await this.llm.makeAIRequestAsync(question, events.onMessage);

        stage("writing answer and brief");
        const [answer, brief] = await Promise.all([
            this.llm.writeFriendlyAnswerAsync(question, research),
            this.llm.writeInfographicBriefAsync(question, research),
        ]);

        const imagePrompt = renderImagePrompt(brief, {
            language: OutputConfig.language,
            aspectRatio: ImageConfig.aspectRatio,
            paletteOverride: ImageConfig.paletteOverride,
        });

        const { sources } = digestResearch(research.messages);
        const base: InfographicRun = {
            answer,
            brief,
            imagePrompt,
            sources,
            truncated: research.truncated,
        };

        if (options.dryRun) return base;

        stage(`drawing ${ImageConfig.resolution} infographic`);
        const image = await this.images.generateAsync(imagePrompt);

        stage("saving");
        const saved = await saveInfographicAsync(image, {
            question,
            answer,
            imagePrompt,
            brief,
            sources,
            truncated: research.truncated,
        });

        return { ...base, saved, costUsd: image.costUsd };
    }
}
