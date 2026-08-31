import "../env.js";
import { createResearchAgent } from "../services/LLMService.js";

/**
 * Entry point for the LangGraph dev server (`npm run langchain:server`).
 *
 * Studio renders the model/tools loop and every tool call's arguments and result,
 * which is a much better way to inspect the agent than reading console output.
 */
export const graph = createResearchAgent();
