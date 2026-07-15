import { env } from "./env.js";
import { LLMService } from "./services/LLMService.js";

console.log(`my vars: ${env.LANGCHAIN_PROJECT}`);

const llmService = new LLMService();

//const result = await llmService.makeAIRequestAsync("Hello, how are you?");
//console.log(result.messages.at(-1)?.content);