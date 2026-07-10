# Tests

Reusable test template for course projects. Copy this `tests/` folder when starting a new project.

## Run

From `01-langchain-basics/`:

```bash
npm test              # run once
npm run test:watch    # re-run on file changes
```

## Layout

```
tests/
├── register.ts           # env defaults (loaded via --import before tests)
├── helpers/
│   └── fake-llm.ts       # shared fakeModel helpers
├── unit/                 # fast, isolated tests — no network
│   └── services/
│       └── LLMService.test.ts
└── README.md
```

| Folder | Purpose |
| ------ | ------- |
| `register.ts` | Sets dummy env vars so imports like `config.ts` don't fail |
| `helpers/` | Reusable fakes and fixtures |
| `unit/` | Mirrors `src/` — add `unit/graph/`, `unit/controllers/`, etc. |

Future: `integration/` for real LLM calls (gated by env flag).

## How it works

`npm test` runs:

```
node --import ./tests/register.ts --import tsx --test tests/**/*.test.ts
```

1. **`register.ts`** — sets `OPENAI_API_KEY` and other defaults before any test file loads
2. **`tsx`** — lets Node run `.ts` files without compiling
3. **`node:test`** — built-in test runner (no extra install)
4. **`node:assert/strict`** — built-in assertions

## Mocking the LLM (no real API calls)

LangChain ships in-memory fakes. Use **`fakeModel`** from `langchain`:

```typescript
import { fakeModel } from "langchain";
import { AIMessage } from "@langchain/core/messages";

const model = fakeModel().respond(new AIMessage("Mock reply"));
const service = new LLMService(model);  // inject fake instead of ChatOpenAI
```

Or use helpers from [`helpers/fake-llm.ts`](helpers/fake-llm.ts):

```typescript
import { createReplyModel } from "../../helpers/fake-llm.js";

const model = createReplyModel("Mock reply");
```

### Why injection instead of HTTP mocking?

- `LLMService` accepts an optional `BaseChatModel` in its constructor
- Production: `new LLMService()` → real `ChatOpenAI`
- Tests: `new LLMService(fakeModel())` → no network, no API key, no cost
- You can assert what the model received: `model.calls`, `model.callCount`

### Alternatives

| Approach | When to use |
| -------- | ----------- |
| `fakeModel` | Agents, tool calls, error simulation (preferred) |
| `FakeListChatModel` from `@langchain/core/utils/testing` | Simple sequential text responses |
| Real API | `tests/integration/` only, with env gate |

See [LangChain unit testing docs](https://docs.langchain.com/oss/javascript/langchain/test/unit-testing).

## Adding a test

1. Create `tests/unit/<layer>/<Name>.test.ts` mirroring `src/`
2. Import from `node:test` and `node:assert/strict`
3. Use `.js` extensions in import paths (ESM convention)
4. Inject fakes for anything that hits the network

Example:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("MyService", () => {
  it("does something", () => {
    assert.equal(1 + 1, 2);
  });
});
```

## Copying to a new project

1. Copy `tests/` (register, helpers, unit layout, this README)
2. Add `"test"` and `"test:watch"` scripts to the new project's `package.json`
3. Ensure `tsx` is in devDependencies and Node >= 24
4. Use constructor injection for services that call external APIs
