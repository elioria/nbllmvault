# 🧠 nbllmvault

A **NotebookLM-style knowledge studio** built on the [SwarmVault](https://github.com/swarmclawai/swarmvault) engine.

Import content from many sources (PDFs, DOCX, URLs, arXiv, YouTube, notes, code, email, 30+ formats), **compile** it into a linked Markdown wiki + knowledge graph, then **ask grounded questions** with citations — all local-first and offline by default.

- **Frontend** — React 19 + Vite 7.3 + Tailwind v4 + shadcn/ui (3-pane NotebookLM layout)
- **Backend** — Hono, a thin HTTP layer over `@swarmvaultai/engine`
- **Engine** — SwarmVault does the heavy lifting: extraction, compilation, RAG, graph, search

> **Main advantage over NotebookLM: you own your data.** One click exports your
> entire notebook — sources, compiled wiki, knowledge graph — as open Markdown +
> JSON (full vault, Obsidian vault, AI pack for any LLM, or raw graph). No
> lock-in, no proprietary format. See **[DOCS.md](DOCS.md)** for the full
> comparison, pros/cons, and implementation details.

## How it maps to NotebookLM

| NotebookLM | nbllmvault |
|---|---|
| Notebook | A SwarmVault **vault** (one directory per notebook) |
| Sources | `ingestInput` (files) / `addInput` (URLs, smart capture) |
| Notebook guide / notes | Compiled **wiki pages** (`compileVault`) linked by `[[wikilinks]]` |
| Chat (grounded Q&A) | `askChatSession` — RAG over the compiled wiki, with citations |
| (extra) Knowledge graph | `state/graph.json` — concepts, entities, communities |

## Architecture

```
apps/
  server/   Hono API — one notebook == one vault dir under data/vaults/<id>
  web/      React + Vite 7.3 + Tailwind v4 + shadcn UI (proxies /api -> server)
data/       notebooks.json registry + per-notebook vaults (gitignored)
```

Every engine call is keyed by a vault `rootDir`. The server keeps a small
`notebooks.json` registry and forwards to the engine; no database needed.

## Quickstart

Requires **Node >= 24** and **pnpm**.

```bash
pnpm install
cp .env.example .env        # optional — works fully offline without keys
pnpm dev                    # starts Hono (:8799) + Vite (:5174)
```

Open http://localhost:5174 → **New notebook** → add sources → **Compile wiki** → ask questions.

### Run pieces individually

```bash
pnpm dev:server   # Hono API on :8799
pnpm dev:web      # Vite dev server on :5174 (proxies /api to :8799)
```

### Production build

```bash
pnpm build        # builds web bundle + server
```

## Providers

- **No API key** → built-in `heuristic` provider: extractive, offline, zero network.
- **`ANTHROPIC_API_KEY`** → Claude (default `claude-opus-4-8`) for synthesis.
- **`OPENAI_API_KEY`** → OpenAI (default `gpt-4o`).

The provider is wired into each notebook's vault at creation. Override the model
with `NBLLMVAULT_MODEL`.

## API surface (server)

```
GET    /api/notebooks                       list notebooks
POST   /api/notebooks                       create  { name }
GET    /api/notebooks/:id                   detail + workspace info
PATCH  /api/notebooks/:id                   rename  { name }
DELETE /api/notebooks/:id                   delete

GET    /api/notebooks/:id/sources           list sources
POST   /api/notebooks/:id/sources/file      multipart upload (field: file)
POST   /api/notebooks/:id/sources/url       { url }   smart capture
POST   /api/notebooks/:id/sources/text      { title, text }

POST   /api/notebooks/:id/compile           compile wiki + graph + index
GET    /api/notebooks/:id/pages             list compiled pages
GET    /api/notebooks/:id/page?path=...     read one page (markdown)
GET    /api/notebooks/:id/search?q=...      hybrid FTS search
POST   /api/notebooks/:id/chat              { question, sessionId? }  grounded RAG

GET    /api/notebooks/:id/export/full       full vault (.zip) — re-openable in SwarmVault
GET    /api/notebooks/:id/export/wiki       markdown wiki (.zip)
GET    /api/notebooks/:id/export/obsidian   Obsidian vault (.zip)
GET    /api/notebooks/:id/export/aipack     AI pack (.zip) — feed any LLM
GET    /api/notebooks/:id/export/graph      knowledge graph (.json)
```

## End-to-end test

```bash
node node_modules/playwright/cli.js install chromium   # once
pnpm dev                                                # in another shell
node apps/web/e2e/smoke.mjs                             # drives the full flow
```

Drives: create notebook → add source → compile → open page → grounded chat.

## License

MIT. SwarmVault is MIT-licensed by swarmclawai.
