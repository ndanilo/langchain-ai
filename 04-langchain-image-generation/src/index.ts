import "./env.js";
import { createInterface } from "node:readline/promises";
import { relative } from "node:path";
import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { InfographicPipeline } from "./pipeline.js";
import { formatToolTrace } from "./lib/trace.js";
import { createProgress } from "./lib/progress.js";

const USAGE = `Usage: tsx src/index.ts [options] [question]

Researches a question on the web and draws an infographic from the answer.
Without a question, starts an interactive prompt.

Options:
  --trace     log each tool call and its result as they happen
  --raw       also show the infographic brief and the image prompt
  --dry-run   stop before the image model: no image, nothing billed
  --quiet     no progress indicator, even on a terminal
  --help      show this message

Only the answer and the saved path go to stdout; progress and diagnostics go to
stderr, so "npx tsx src/index.ts \\"question\\" > answer.txt" saves just the answer.`;

const args = process.argv.slice(2);

if (args.includes("--help")) {
    console.error(USAGE);
    process.exit(0);
}

const flags = {
    trace: args.includes("--trace"),
    raw: args.includes("--raw"),
    dryRun: args.includes("--dry-run"),
    // A spinner in a redirected stream is noise, so default to terminals only.
    progress: !args.includes("--quiet") && Boolean(process.stderr.isTTY),
};

const pipeline = new InfographicPipeline();

/** Short label for whatever the research agent is doing right now. */
function describe(message: BaseMessage): string | undefined {
    if (AIMessage.isInstance(message) && message.tool_calls?.length) {
        return message.tool_calls.map((call) => call.name).join(" + ");
    }

    if (ToolMessage.isInstance(message)) {
        return "thinking";
    }

    return undefined;
}

async function ask(question: string) {
    const progress = createProgress(flags.progress);

    try {
        const run = await pipeline.runAsync(
            question,
            {
                onStage: (label) => progress.step(label),
                onMessage: (message) => {
                    const label = describe(message);
                    if (label) progress.step(label);

                    if (flags.trace) {
                        for (const line of formatToolTrace([message])) {
                            progress.log(line);
                        }
                    }
                },
            },
            { dryRun: flags.dryRun },
        );

        if (run.truncated) {
            progress.log("  ! tool budget spent before the agent finished; drawing what it found");
        }

        if (flags.raw) {
            progress.log(`\n--- brief ---\n${JSON.stringify(run.brief, null, 2)}`);
            progress.log(`\n--- image prompt ---\n${run.imagePrompt}`);
        }

        progress.done();
        console.log(`\n${run.answer}\n`);

        if (run.saved) {
            const cost = run.costUsd === undefined ? "" : ` ($${run.costUsd.toFixed(3)})`;
            console.log(`Infographic: ${relative(process.cwd(), run.saved.imagePath)}${cost}\n`);
        } else {
            console.log("Dry run: no image generated.\n");
        }
    } finally {
        progress.done();
    }
}

const cliQuestion = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();

if (cliQuestion) {
    try {
        await ask(cliQuestion);
    } catch (error) {
        console.error(`Request failed: ${(error as Error).message}`);
        process.exit(1);
    }
} else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.error("Ask anything. Empty line to quit.\n");

    while (true) {
        const question = (await rl.question("> ")).trim();
        if (!question) break;

        try {
            await ask(question);
        } catch (error) {
            console.error(`Request failed: ${(error as Error).message}\n`);
        }
    }

    rl.close();
}
