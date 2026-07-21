# 02-langchain-quiz-generator

Part of the **Applied AI Engineering** course. A LangGraph.js quiz pipeline in progress — currently focused on **structured fact extraction** from long text (the first stage before question generation).

## What it covers

- Zod schemas as the contract for structured LLM output (`factsSchema`)
- `createAgent` + `providerStrategy` for typed `structuredResponse`
- A LangGraph node (`extractFact`) that maps structured facts into graph state
- Unit tests with LangChain `fakeModel` (no API calls in tests)

## Status

Incomplete by design. Fact extraction works; quiz question generation and later stages are not built yet.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 (managed via [nvm](https://github.com/nvm-sh/nvm))
- API keys for the providers you plan to use (see `.env.example`)

## Setup

From this folder:

```bash
cd 02-langchain-quiz-generator   # from repo root
nvm use 24                       # or `nvm use` if your nvm reads .nvmrc automatically
npm install
cp .env.example .env             # then fill in your keys
```

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Run the main app with hot reload |
| `npm start` | Invoke the compiled graph once (demo text) |
| `npm run langchain:server` | Start the LangGraph dev server |
| `npm run typecheck` | Type-check without emit |
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests (no real LLM calls) |
| `npm run test:watch` | Run tests in watch mode |

## Project layout

```
02-langchain-quiz-generator/
├── examples/          # one folder per experiment (add as you go)
├── src/
│   ├── graph/         # schemas, prompts, nodes, compiled graph
│   └── services/      # LLMService (structured output)
├── tests/             # unit tests mirroring src/
├── package.json
├── tsconfig.json
├── langgraph.json
└── .env.example
```

## Resources

- [LangChain.js docs](https://js.langchain.com/docs/)
- [LangGraph.js docs](https://langchain-ai.github.io/langgraphjs/)
- [LangSmith docs](https://docs.smith.langchain.com/)
