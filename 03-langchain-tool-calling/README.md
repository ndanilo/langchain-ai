# 03-langchain-tool-calling

Part of the **Applied AI Engineering** course. Tool calling with LangChain.js on **Node.js** and **TypeScript**.

Ask a question about something current and the agent decides on its own to check the date,
search the web, read the promising pages, and answer with sources.

## What it covers

- Zod-based environment validation
- `ChatOpenAI` via OpenRouter
- `createAgent` with a real toolset and a system prompt
- A hand-written tool (`tool()` + Zod schema) next to prebuilt Tavily integrations
- A two-stage pipeline: research at temperature 0, then presentation at 0.4
- Printing the tool-call trace so the agent loop is visible
- Unit tests that drive the loop with LangChain `fakeModel` (no API calls in tests)
- A hello-world LangGraph (uppercases the last message), kept as a graph-API example

## How the loop works

The model never executes anything. It receives your tools as JSON Schema, replies with a
*request* to call one (`name` + `arguments`), and LangChain runs your function, appends the
result as a `ToolMessage`, and sends the conversation back. That repeats until the model
stops asking for tools. `recursionLimit` in `src/config/config.ts` caps the loop.

## Two stages, two temperatures

One question makes two trips to the model, because accuracy and readability are different
jobs and want different settings.

| Stage | Method | Temperature | Job |
| ----- | ------ | ----------- | --- |
| Research | `makeAIRequestAsync` | `0` | Call tools in a loop, gather precise facts. Dry output is fine. |
| Presentation | `writeFriendlyAnswerAsync` | `0.4` | Rewrite those facts as something a person wants to read. No tools. |

Stage 1 runs at 0 because choosing a tool and its arguments is a classification decision —
randomness there only produces wrong tool calls.

Stage 2 runs warmer because its job is a style transformation over facts that are already
pinned down: a little sampling freedom yields natural phrasing instead of stiff, templated
prose. It stays at 0.4 rather than 0.7 because the failure mode of a warm presenter is
embellishment — inventing a precise number, dropping a hedge, or "improving" a caveat.
0.3–0.5 is the useful band for restyling; 0.7+ is for work where you actually want
invention, like brainstorming or copywriting.

Between the stages, `digestResearch()` collapses the finished run into what the presenter
needs: the agent's findings, truncated raw tool output, and the deduplicated source URLs.
Capping the evidence per tool call is what keeps the second prompt small.

Note that temperature is a diversity knob, not a quality knob. It does not make output more
thorough or better written — that comes from the prompt.

## Keeping the agent from spiralling

Left alone, an agent chasing a figure it cannot pin down will rephrase the same search
forever. Observed here: a question about the dollar rate in Portuguese produced 13+ tool
calls in 88 seconds, hit the recursion limit, and returned nothing. Three defences, in
order of how early they fire:

1. **The prompt** tells it never to repeat a search with different wording or a narrower
   date, and that an approximate answer with a caveat beats silence. This does most of the
   work — the same question now finishes in two tool calls.
2. **`toolCallLimitMiddleware`** caps tool calls per question (`maxToolCallsPerRun`).
   `exitBehavior: "continue"` blocks further calls and hands control back to the model so
   it still writes an answer. `"end"` cannot be used here because it throws when a step
   contains several parallel tool calls, which this agent routinely produces.
3. **`recursionLimit`** is the last backstop. If it trips, the run is not lost:
   `makeAIRequestAsync` streams, so it catches `GraphRecursionError` and returns the
   messages gathered so far with `truncated: true`, and the presenter is told to hedge.

Because the budget can end a run on a framework `ToolMessage` rather than an answer,
`digestResearch()` takes its findings from the last AI message with text, not the last
message.

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

Expect spiky latency. Measured on this OpenRouter model, the same trivial prompt took
anywhere from 1s to 25s, and requests can stall much longer. `ChatOpenAI` ships with
`timeout: undefined`, meaning a stalled request hangs the process forever, so
`requestTimeoutMs` and `maxRetries` in `src/config/config.ts` are load-bearing rather than
decorative. A full two-stage run typically takes 30–45s.

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
npm start                                            # interactive prompt
npx tsx src/index.ts "who won the last F1 race?"     # one-shot
npx tsx src/index.ts --trace "usd to brl rate?"      # show which tools ran
npx tsx src/index.ts --raw   "usd to brl rate?"      # show the research draft too
npx tsx src/index.ts --quiet "usd to brl rate?"      # no progress indicator
npx tsx src/index.ts --help
```

A run takes 20–45s, so on a terminal you get a one-line spinner on stderr showing the
current step and elapsed time. It is disabled automatically when stderr is not a TTY, so
pipes and redirects stay clean; `--quiet` disables it on a terminal too.

`--trace` adds one line per step of the agent loop, where `->` is the model requesting a
tool and `<-` is what your code handed back:

```
  -> get_current_datetime {}
  -> web_search {"query":"USD to BRL exchange rate today","topic":"finance"}
  <- get_current_datetime {"iso":"2026-08-31T13:08:30.596Z","timeZone":"UTC",...}
  <- web_search 5 results, 6.4k chars, xe.com, revolut.com, tradingeconomics.com +2 more
```

`--raw` additionally prints stage 1's draft, which is the interesting comparison while
learning: same facts, different readability.

### Output goes to two streams

The answer goes to **stdout**; the trace, the draft and errors go to **stderr**. So you can
watch the loop and still capture a clean result:

```bash
npx tsx src/index.ts --trace "usd to brl rate?" > answer.txt   # file holds only the answer
npx tsx src/index.ts --trace "usd to brl rate?" 2> $null       # answer only, no trace
```

Nothing else writes to the console. Tavily does not log during normal operation, and
dotenv's startup banner is suppressed with `config({ quiet: true })` in `src/env.ts`.
The one exception is `@langchain/tavily`, which has a stray `console.log(response)` that
fires only when a Tavily request fails (bad key, rate limit) before it throws.

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
│   ├── lib/           # trace formatting for the CLI
│   ├── services/      # LLMService: research stage + presenter stage
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
