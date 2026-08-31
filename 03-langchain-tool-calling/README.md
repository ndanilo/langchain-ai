# 03-langchain-tool-calling

Part of the **Applied AI Engineering** course. Tool calling with LangChain.js on **Node.js** and **TypeScript**.

Ask a question about something current and the agent decides on its own to check the date,
search the web, read the promising pages, and answer with sources.

## What it covers

- Zod-based environment validation
- `ChatOpenAI` via OpenRouter
- `createAgent` with a real toolset and a system prompt
- A hand-written tool (`tool()` + Zod schema) next to prebuilt Tavily integrations
- Printing the tool-call trace so the agent loop is visible
- Unit tests that drive the loop with LangChain `fakeModel` (no API calls in tests)
- A hello-world LangGraph (uppercases the last message), kept as a graph-API example

## How the loop works

The model never executes anything. It receives your tools as JSON Schema, replies with a
*request* to call one (`name` + `arguments`), and LangChain runs your function, appends the
result as a `ToolMessage`, and sends the conversation back. That repeats until the model
stops asking for tools. `recursionLimit` in `src/config/config.ts` caps the loop.

## Tools

Defined in `src/tools/`. Names are `snake_case` and descriptions are written to steer the
intended chain — search to find URLs, extract to read them, crawl/map only for whole sites.

| Tool | Source | Purpose |
| ---- | ------ | ------- |
| `get_current_datetime` | hand-written | Anchors "now" so the model can judge freshness. The reference `tool()` example. |
| `web_search` | `TavilySearch` | Ranked results with snippets. First stop for current facts. |
| `web_extract` | `TavilyExtract` | Cleaned page content for known URLs. The read step after a search. |
| `web_map` | `TavilyMap` | Lists a site's URLs without downloading them. |
| `web_crawl` | `TavilyCrawl` | Follows links from a URL and returns page content. Slow and expensive. |

`createResearchTools()` returns the lean default (date + search + extract).
`createAllTools()` adds map and crawl. Fewer tools are chosen more reliably, so the agent
uses the lean set unless you pass something else to `LLMService`.

Tavily also ships `TavilyResearch` / `TavilyGetResearch` for long-running research jobs;
they are not wired up here.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 (managed via [nvm](https://github.com/nvm-sh/nvm))
- An OpenRouter key, and a model that **supports tool calling** — check the model's
  supported parameters on OpenRouter, since a model that ignores the `tools` array looks
  exactly like a bug in your code
- A [Tavily](https://app.tavily.com) key (free tier is enough)

## Setup

From this folder:

```bash
cd 03-langchain-tool-calling   # from repo root
nvm use 24                    # or `nvm use` if your nvm reads .nvmrc automatically
npm install
cp .env.example .env          # then fill in OPENAI_API_KEY and TAVILY_API_KEY
```

## Usage

```bash
npm start                                   # interactive prompt
npx tsx src/index.ts "who won the last F1 race?"   # one-shot
```

Each run prints the trace before the answer: `->` is the model requesting a tool, `<-` is
what your code returned.

```
  -> get_current_datetime {}
  -> web_search {"query":"USD to BRL exchange rate today","topic":"finance"}
  <- get_current_datetime {"iso":"2026-08-31T05:18:11.370Z",...}
  <- web_search {"results":[{"url":"https://www.xe.com/...
```

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Interactive prompt (or pass a question as an argument) |
| `npm run dev` | Same, with hot reload |
| `npm run langchain:server` | LangGraph dev server: `research_agent` and `hello_world` |
| `npm run typecheck` | Type-check without emit |
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests (no real LLM or Tavily calls) |
| `npm run test:watch` | Run tests in watch mode |

`npm run langchain:server` is the best way to inspect a run: LangGraph Studio draws the
loop and shows every tool call's arguments and result. Setting `LANGSMITH_API_KEY` gives
the same detail as a hosted trace.

## Project layout

```
03-langchain-tool-calling/
├── examples/          # one folder per experiment (add as you go)
├── src/
│   ├── config/        # validated model + Tavily settings
│   ├── graph/         # LangGraph entry points for the dev server
│   ├── services/      # LLMService: model + tools + prompt -> agent
│   ├── tools/         # the toolset
│   ├── env.ts         # the only place that reads process.env
│   └── index.ts       # CLI entry point
├── tests/             # project tests
├── package.json
├── tsconfig.json
├── langgraph.json
└── .env.example
```

## Resources

- [Tools](https://docs.langchain.com/oss/javascript/langchain/tools) — start here
- [Agents / `createAgent`](https://docs.langchain.com/oss/javascript/langchain/agents)
- [Tool integrations](https://docs.langchain.com/oss/javascript/integrations/tools/index)
- [What's new in LangChain v1](https://docs.langchain.com/oss/javascript/releases/langchain-v1)
- [v1 migration guide](https://docs.langchain.com/oss/javascript/migrate/langchain-v1) — useful as a filter: most blog tutorials still show the deprecated `AgentExecutor` / `createReactAgent` patterns
- [API reference](https://reference.langchain.com/javascript/langchain/)
- [LangSmith docs](https://docs.smith.langchain.com/)
