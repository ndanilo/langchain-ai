# langchain-ai

A personal workspace for **Applied AI Engineering** course projects and experiments. Each project is self-contained with its own dependencies, environment, and scripts.

Shared tooling (`.cursor/`, git history) lives at the repository root. Work inside a project folder for install, run, and development.

## Projects

| Project | Description |
| ------- | ----------- |
| [01-langchain-basics](./01-langchain-basics/) | Basic LangChain.js integration: env validation, OpenRouter chat model, agent call, and hello-world LangGraph |
| [02-langchain-quiz-generator](./02-langchain-quiz-generator/) | Quiz pipeline (in progress): structured fact extraction with Zod + LangGraph |

## Adding a new project

1. Create a folder at the repo root with a numeric prefix, e.g. `03-rag-basics/`
2. Add its own `package.json`, README, and `.env.example`
3. List it in the table above
4. Keep experiments or modules inside that project — do not share `node_modules` across projects

## Repository layout

```
.
├── .cursor/                       # shared Cursor rules (all projects)
├── .git/
├── README.md                      # this file
├── 01-langchain-basics/           # first course project
└── 02-langchain-quiz-generator/   # structured output + quiz pipeline
```

## Prerequisites

- [Node.js](https://nodejs.org/) 24 (most projects use [nvm](https://github.com/nvm-sh/nvm))
- API keys as required by each project (see each project's `.env.example`)
