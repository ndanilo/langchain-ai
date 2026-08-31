import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NODE_ENV ??= "test";
process.env.OPENAI_API_KEY ??= "test-api-key";
process.env.TAVILY_API_KEY ??= "test-tavily-key";
process.env.IMAGE_API_KEY ??= "test-image-key";
process.env.LANGCHAIN_PROJECT ??= "04-langchain-image-generation-test";

// Keep anything a test writes out of the project folder.
process.env.IMAGE_OUTPUT_DIR ??= join(tmpdir(), "04-langchain-image-generation-tests");
