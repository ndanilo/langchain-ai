# 04-langchain-image-generation

Part of the **Applied AI Engineering** course. Image generation with LangChain.js on **Node.js**
and **TypeScript**.

Ask a question, and the app researches it on the web, reduces the answer to the handful of
figures worth drawing, and generates an infographic poster — by default in Brazilian
Portuguese — which it saves to a git-ignored folder.

## What it covers

- The tool-calling research agent from
  [03-langchain-tool-calling](../03-langchain-tool-calling/), reused unchanged
- Structured output (`createAgent` + `providerStrategy` + Zod) as the contract between a
  writing model and an image model
- A second model with a different modality, on a different endpoint, in the same app
- Deterministic prompt composition, so the text drawn on the poster is never paraphrased
- Writing generated artefacts to disk with enough metadata to reproduce them

## The pipeline

```
question
  -> research      tool-calling agent: date, web_search, web_extract        temp 0
  -> brief         structured copy for the poster, in the output language   temp 0.2
     answer        the prose reply for the chat                             temp 0.4
  -> image prompt  plain string building, no model
  -> image model   OpenRouter POST /api/v1/images
  -> disk          <IMAGE_OUTPUT_DIR>/<timestamp>-<slug>.png + .json sidecar
```

The brief and the answer both read the same finished research and neither depends on the
other, so they run together.

### Why the image prompt is not written by a model

The brief stage returns structured data — a title, three or four `label` / `figure` / `note`
panels, a takeaway — and `renderImagePrompt()` composes the prompt from it with plain string
concatenation.

Asking a model to "write an image prompt" instead would give it one more opportunity to
paraphrase, and a paraphrased figure is a wrong number rendered in 200pt type. Composing the
prompt ourselves means every string is quoted verbatim.

### Where the model *is* creative

The prompt has two halves and the split is the whole idea. The **text half** is rigid and
repetitive, because that is the only way an image model spells a string correctly. The
**art half** is loose, because that is where the image model is good and where a tight
specification produces a corporate slide.

So the brief also carries `art.palette`, `art.mood` and a per-panel `icon`, all chosen by
the writing model, all in English, none of it printed. A Magic: The Gathering poster gets
arcane violets and a phoenix; an inflation poster gets something else.

The first version had this backwards. It pinned `flat design`, `generous margins and white
space`, `simple flat icons` and one fixed navy-and-amber palette for every subject — and
produced exactly what it asked for: a 2015 slide deck with a stock trophy and a clipboard on
a poster about a card game. `IMAGE_PALETTE` survives only as an optional override for brand
colours; left empty, the model decides.

Two things that do belong in the fixed half, both learned the hard way: never invite
decorative lettering (`oversized numerals bleeding off an edge` got a stray `2 6` stamped
down the side), and say explicitly that each string appears exactly once, or a label gets
drawn twice.

### Two things that only show up against a real model

Both were found by running `--dry-run` and reading the output, and both are worth knowing
before you write your own schema.

**Length limits do not belong in the schema.** `z.string().max(70)` becomes `maxLength: 70`
in the JSON schema, and providers honour that during constrained decoding by *cutting the
string off* at 70 characters — mid-word, mid-number. A brief came back reading
`"13.75% by end of 2"`. The limits now live in the field descriptions, where the model reads
them, and are applied afterwards by `normaliseBrief()`, which cuts on a clause boundary.

**Field names are instructions.** With fields called `heading` / `value`, the model put the
number in `heading` and the bare unit `"a.a."` in `value` — reasonably, since a heading is
the big thing at the top. Renaming them to `label` / `figure` / `note` and giving the system
prompt one worked example fixed it outright.

### Language

`OUTPUT_LANGUAGE` (default `pt-BR`) drives the answer, the brief, and every label drawn on
the poster. The tag is resolved to an English language name with `Intl.DisplayNames`, because
`Brazilian Portuguese` steers a model far better than `pt-BR` does.

The instruction is repeated in both the system prompt and the user message. With it only in
the system prompt, the brief came back in English: research notes are usually in English, and
the notes win.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 (managed via [nvm](https://github.com/nvm-sh/nvm))
- An OpenRouter key, and a chat model that **supports tool calling**
- A [Tavily](https://app.tavily.com) key (free tier is enough)
- An OpenRouter image model — browse
  [models with image output](https://openrouter.ai/models?output_modalities=image)

Both models bill to the same OpenRouter key unless you set `IMAGE_API_KEY`. A full run takes
2–4 minutes end to end, most of it in the image model, and costs a few cents.

## Setup

From this folder:

```bash
cd 04-langchain-image-generation   # from repo root
nvm use 24                         # or `nvm use` if your nvm reads .nvmrc automatically
npm install
cp .env.example .env               # then fill in OPENAI_API_KEY and TAVILY_API_KEY
```

## Usage

```bash
npm start                                                  # interactive prompt
npx tsx src/index.ts "qual a taxa Selic atual?"            # one-shot
npx tsx src/index.ts --dry-run "..."                       # no image, nothing billed
npx tsx src/index.ts --raw "..."                           # show the brief and the prompt
npx tsx src/index.ts --trace "..."                         # show which tools ran
npx tsx src/index.ts --quiet "..."                         # no progress indicator
npx tsx src/index.ts --help
```

`--dry-run` is the one to develop against: it runs everything except the image call, so you
can iterate on the brief and the prompt without paying for a render each time.

`--trace` adds one line per step of the agent loop, where `->` is the model requesting a tool
and `<-` is what your code handed back:

```
  -> get_current_datetime {}
  -> web_search {"query":"taxa Selic atual agosto 2026 Copom"}
  <- web_search 5 results, 5.5k chars, estadao.com.br, investidor10.com.br +2 more
```

### Output goes to two streams

The answer and the saved path go to **stdout**; the trace, the brief and errors go to
**stderr**. So you can watch the run and still capture a clean result.

## Output

Each run writes two files to `IMAGE_OUTPUT_DIR` (git-ignored):

| File | Contents |
| ---- | -------- |
| `<timestamp>-<slug>.png` | The poster |
| `<timestamp>-<slug>.json` | Question, answer, brief, exact image prompt, source URLs, model, cost |

The sidecar is what makes the folder usable a week later: without it you cannot tell which
question produced which poster, or what to change to get a better one. Filenames are slugged
from the title with accents folded (`Inflação` becomes `inflacao`) and colons stripped, since
Windows rejects them.

## Configuration

Everything below is read in `src/env.ts` and validated into `src/config/config.ts`. Every
variable has a default, so a `.env` with just the two API keys works.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `CHAT_MODEL` | `deepseek/deepseek-v4-flash-0731` | Research, brief and answer. Needs tool calling. |
| `IMAGE_MODEL` | `bytedance-seed/seedream-4.5` | Any slug whose output modality is image |
| `IMAGE_API_KEY` | falls back to `OPENAI_API_KEY` | Set to bill image generation elsewhere |
| `IMAGE_API_HOST` | `https://openrouter.ai/api/v1` | `/images` is appended |
| `IMAGE_ASPECT_RATIO` | `9:16` | Infographics are read top to bottom |
| `IMAGE_RESOLUTION` | `2K` | Below 2K the small labels come back unreadable |
| `IMAGE_OUTPUT_FORMAT` | `png` | `png`, `jpeg` or `webp` |
| `IMAGE_PALETTE` | *(empty)* | Optional palette override. Empty means the model picks one per subject. |
| `IMAGE_REQUEST_TIMEOUT_MS` | `180000` | A 2K render outlasts a chat completion |
| `IMAGE_OUTPUT_DIR` | `generated-images` | Git-ignored. Change `.gitignore` too. |
| `OUTPUT_LANGUAGE` | `pt-BR` | Answer, brief and every label on the poster |

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Interactive prompt (or pass a question as an argument) |
| `npm run dev` | Same, with hot reload and `--trace` |
| `npm run langchain:server` | LangGraph dev server: `research_agent` and `hello_world` |
| `npm run typecheck` | Type-check without emit |
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests (no real LLM, Tavily or image calls) |
| `npm run test:watch` | Run tests in watch mode |

## Project layout

```
04-langchain-image-generation/
├── examples/          # one folder per experiment (add as you go)
├── generated-images/  # output, git-ignored
├── src/
│   ├── config/        # validated model, Tavily, image and output settings
│   ├── graph/         # LangGraph entry points for the dev server
│   ├── infographic/   # brief schema + image prompt composition
│   ├── lib/           # trace formatting, progress spinner, file store
│   ├── services/      # LLMService (3 stages) and ImageService (OpenRouter /images)
│   ├── tools/         # the research toolset
│   ├── env.ts         # the only place that reads process.env
│   ├── pipeline.ts    # question -> poster, with no terminal in sight
│   └── index.ts       # CLI entry point
├── tests/             # project tests
├── package.json
├── tsconfig.json
├── langgraph.json
└── .env.example
```

`ImageService` is hand-written rather than routed through LangChain because image generation
is not a chat completion: OpenRouter serves it from a dedicated `/images` endpoint that takes
a prompt and returns base64 bytes, with no messages and no tools. It takes its `fetch` through
the constructor, which is how the tests cover it without a network.

## Resources

- [OpenRouter image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [`POST /api/v1/images` reference](https://openrouter.ai/docs/api/api-reference/images/generate-an-image)
- [Structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- [Agents / `createAgent`](https://docs.langchain.com/oss/javascript/langchain/agents)
- [Multimodal inputs and outputs](https://docs.langchain.com/oss/javascript/langchain/models)
- [LangSmith docs](https://docs.smith.langchain.com/)
