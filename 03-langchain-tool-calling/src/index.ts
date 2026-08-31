import { env } from "./env.js";
import { createInterface } from "node:readline/promises";
import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { LLMService } from "./services/LLMService.js";
import { formatToolTrace } from "./lib/trace.js";
import { createProgress } from "./lib/progress.js";

const USAGE = `Usage: tsx src/index.ts [options] [question]

Without a question, starts an interactive prompt.

Options:
  --trace   log each tool call and its result as they happen
  --raw     also show the research draft before the final answer
  --quiet   no progress indicator, even on a terminal
  --help    show this message

Only the answer goes to stdout; progress and diagnostics go to stderr, so
"npx tsx src/index.ts \\"question\\" > answer.txt" saves just the answer.`;

const args = process.argv.slice(2);

if (args.includes("--help")) {
    console.error(USAGE);
    process.exit(0);
}

const flags = {
    trace: args.includes("--trace"),
    raw: args.includes("--raw"),
    // A spinner in a redirected stream is noise, so default to terminals only.
    progress: !args.includes("--quiet") && Boolean(process.stderr.isTTY),
};

const llmService = new LLMService();

/** Short label for whatever the agent is doing right now. */
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
        progress.step("researching");

        const research = await llmService.makeAIRequestAsync(question, (message) => {
            const label = describe(message);
            if (label) progress.step(label);

            if (flags.trace) {
                for (const line of formatToolTrace([message])) {
                    progress.log(line);
                }
            }
        });

        if (research.truncated) {
            progress.log("  ! tool budget spent before the agent finished; answering with what it found");
        }

        if (flags.raw) {
            progress.log(`\n--- research draft ---\n${research.messages.at(-1)?.content}`);
            progress.log("\n--- friendly answer ---");
        }

        progress.step("writing answer");
        const answer = await llmService.writeFriendlyAnswerAsync(question, research);

        progress.done();
        console.log(`\n${answer}\n`);
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
