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

async function ask(question: string) {
    const result = await llmService.makeAIRequestAsync(question);

    printToolTrace(result.messages);
    console.log(`\n${result.messages.at(-1)?.content}\n`);
}

const cliQuestion = process.argv.slice(2).join(" ").trim();

if (cliQuestion) {
    await ask(cliQuestion);
} else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log("Ask anything. Empty line to quit.\n");

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
