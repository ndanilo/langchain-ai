import { env } from "./env.js";
import { LLMService } from "./services/LLMService.js";

const llmService = new LLMService();

const result = await llmService.makeAIRequestAsync("current conversion dollar to brl");
console.log(result.messages.at(-1)?.content);