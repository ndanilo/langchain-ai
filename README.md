# langchain-ai

A personal study workspace for the AI ecosystem: **LangChain**, **LangGraph**, **LangSmith**, structured prompts, tools, and API integrations — built with **Node.js** and **TypeScript**.

Each experiment lives in its own folder. Start small, run it, then move on.

## Goals

- Learn LangChain.js patterns (chains, prompts, tools, agents)
- Explore LangGraph for stateful, multi-step workflows
- Use LangSmith for tracing, debugging, and evaluation
- Practice Node.js and TypeScript along the way

## Prerequisites

- [Node.js](https://nodejs.org/) 24 (managed via [nvm](https://github.com/nvm-sh/nvm))
- API keys for the providers you plan to use (see `.env.example`)

## Setup

```bash
nvm use 24       # or `nvm use` if your nvm reads .nvmrc automatically
npm install
cp .env.example .env   # then fill in your keys
```

## Scripts

| Command          | Description              |
| ---------------- | ------------------------ |
| `npm run typecheck` | Type-check without emit |
| `npm run build`     | Compile TypeScript      |

## Project layout

```
langchain-ai/
├── .cursor/rules/     # AI assistant guidelines
├── examples/          # one folder per experiment (add as you go)
├── package.json
├── tsconfig.json
└── .env.example
```

When starting a new experiment, create a folder under `examples/` (e.g. `examples/01-basic-chain/`) with its own `index.ts` and any local files it needs.

## Resources

- [LangChain.js docs](https://js.langchain.com/docs/)
- [LangGraph.js docs](https://langchain-ai.github.io/langgraphjs/)
- [LangSmith docs](https://docs.smith.langchain.com/)
