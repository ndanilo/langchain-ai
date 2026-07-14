# 01-langchain-basics

Part of the **Applied AI Engineering** course. A minimal LangChain.js integration with **Node.js** and **TypeScript**.

## What it covers

- Zod-based environment validation
- `ChatOpenAI` via OpenRouter
- A basic agent call (`createAgent` with no tools)
- A hello-world LangGraph (uppercases the last message)
- Unit tests with LangChain `fakeModel` (no API calls in tests)

## Prerequisites

- [Node.js](https://nodejs.org/) 24 (managed via [nvm](https://github.com/nvm-sh/nvm))
- API keys for the providers you plan to use (see `.env.example`)

## Setup

From this folder:

```bash
cd 01-langchain-basics   # from repo root
nvm use 24               # or `nvm use` if your nvm reads .nvmrc automatically
npm install
cp .env.example .env     # then fill in your keys
```

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Run the main app with hot reload |
| `npm run langchain:server` | Start the LangGraph dev server |
| `npm run typecheck` | Type-check without emit |
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests (no real LLM calls) |
| `npm run test:watch` | Run tests in watch mode |

Run a single experiment:

```bash
npx tsx examples/<name>/index.ts
```

## Project layout

```
01-langchain-basics/
├── examples/          # one folder per experiment (add as you go)
├── src/               # main app and LangGraph graph
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
