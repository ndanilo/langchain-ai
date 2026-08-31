import { env } from "./env.js";
import { createInterface } from "node:readline/promises";
import { LLMService } from "./services/LLMService.js";
import { createProgress } from "./lib/progress.js";

const USAGE = `Usage: tsx src/index.ts [options] [prompt]

Without a prompt, starts an interactive prompt.

Options:
  --quiet   no progress indicator, even on a terminal
  --help    show this message

Only the answer goes to stdout; progress and diagnostics go to stderr.`;

const args = process.argv.slice(2);

if (args.includes("--help")) {
    console.error(USAGE);
    process.exit(0);
}

const flags = {
    // A spinner in a redirected stream is noise, so default to terminals only.
    progress: !args.includes("--quiet") && Boolean(process.stderr.isTTY),
};

const llmService = new LLMService();

async function ask(prompt: string) {
    const progress = createProgress(flags.progress);

    try {
        progress.step("generating");
        const result = await llmService.makeAIRequestAsync(prompt);
        progress.done();
        console.log(`\n${result.messages.at(-1)?.content}\n`);
    } finally {
        progress.done();
    }
}

const cliPrompt = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();

if (cliPrompt) {
    try {
        await ask(cliPrompt);
    } catch (error) {
        console.error(`Request failed: ${(error as Error).message}`);
        process.exit(1);
    }
} else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.error("Describe an image. Empty line to quit.\n");

    while (true) {
        const prompt = (await rl.question("> ")).trim();
        if (!prompt) break;

        try {
            await ask(prompt);
        } catch (error) {
            console.error(`Request failed: ${(error as Error).message}\n`);
        }
    }

    rl.close();
}
