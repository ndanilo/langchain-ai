import { env } from "./env.js";
import { createInterface } from "node:readline/promises";
import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { LLMService } from "./services/LLMService.js";

const llmService = new LLMService();

/*
The message array is the whole audit trail of a run: an AIMessage carrying tool_calls
is the model asking for a tool, the ToolMessage after it is what our code returned.
Printing it is the fastest way to see whether tool calling is working at all.
*/
function printToolTrace(messages: BaseMessage[]) {
    for (const message of messages) {
        if (AIMessage.isInstance(message)) {
            for (const call of message.tool_calls ?? []) {
                console.log(`  -> ${call.name} ${JSON.stringify(call.args)}`);
            }
        }

        if (ToolMessage.isInstance(message)) {
            const body =
                typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content);
            const preview = body.length > 300 ? `${body.slice(0, 300)}...` : body;
            console.log(`  <- ${message.name} ${preview}`);
        }
    }
}

/*
Two passes over the model. The agent researches with tools at temperature 0, then a
second call rewrites its notes for a human at a warmer temperature. Pass --raw to also
see the researcher's draft, which is the interesting comparison while learning.
*/
async function ask(question: string, showDraft: boolean) {
    const research = await llmService.makeAIRequestAsync(question);
    printToolTrace(research.messages);

    if (showDraft) {
        console.log(`\n--- research draft ---\n${research.messages.at(-1)?.content}`);
        console.log("\n--- friendly answer ---");
    }

    const answer = await llmService.writeFriendlyAnswerAsync(question, research.messages);
    console.log(`\n${answer}\n`);
}

const args = process.argv.slice(2);
const showDraft = args.includes("--raw");
const cliQuestion = args.filter((arg) => arg !== "--raw").join(" ").trim();

if (cliQuestion) {
    await ask(cliQuestion, showDraft);
} else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log("Ask anything. Empty line to quit.\n");

    while (true) {
        const question = (await rl.question("> ")).trim();
        if (!question) break;

        try {
            await ask(question, showDraft);
        } catch (error) {
            console.error(`Request failed: ${(error as Error).message}\n`);
        }
    }

    rl.close();
}
