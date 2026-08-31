# 04-langchain-image-generation

Part of the **Applied AI Engineering** course. Image generation with LangChain.js on **Node.js** and **TypeScript**.

Incomplete by design. Scaffold is in place; image generation is not wired up yet.

## What it covers (scaffold)

- Zod-based environment validation
- `ChatOpenAI` via OpenRouter (timeouts and retries set)
- A basic agent call (`createAgent` with no tools)
- A hello-world LangGraph (uppercases the last message)
- CLI with a stderr progress spinner
- Unit tests with LangChain `fakeModel` (no API calls in tests)

## Prerequisites

- [Node.js](https://nodejs.org/) 24 (managed via [nvm](https://github.com/nvm-sh/nvm))
- API keys for the providers you plan to use (see `.env.example`)

## Setup

From this folder:

```bash
cd 04-langchain-image-generation   # from repo root
nvm use 24                         # or `nvm use` if your nvm reads .nvmrc automatically
npm install
cp .env.example .env               # then fill in your keys
```

## Usage

```bash
npm start                                            # interactive prompt
npx tsx src/index.ts "a red balloon over a lake"     # one-shot
npx tsx src/index.ts --quiet "a red balloon"         # no progress indicator
npx tsx src/index.ts --help
```

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Interactive prompt (or pass a prompt as an argument) |
| `npm run dev` | Same, with hot reload |
| `npm run langchain:server` | LangGraph dev server (`hello_world`) |
| `npm run typecheck` | Type-check without emit |
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests (no real LLM calls) |
| `npm run test:watch` | Run tests in watch mode |

## Project layout

```
04-langchain-image-generation/
├── examples/          # one folder per experiment (add as you go)
├── src/
│   ├── config/        # validated model settings
│   ├── graph/         # LangGraph entry points for the dev server
│   ├── lib/           # CLI progress indicator
│   ├── services/      # LLMService
│   ├── env.ts         # the only place that reads process.env
│   └── index.ts       # CLI entry point
├── tests/             # project tests
├── package.json
├── tsconfig.json
├── langgraph.json
└── .env.example
```

## Resources

- [LangChain.js docs](https://js.langchain.com/docs/)
- [LangGraph.js docs](https://langchain-ai.github.io/langgraphjs/)
- [LangSmith docs](https://docs.smith.langchain.com/)
