# 🧠 nbllmvault

**Languages:** [English](README.md) · [Português (BR)](README.pt-BR.md)

A **local-first, open clone of Google NotebookLM**, built on the open-source
[SwarmVault](https://github.com/swarmclawai/swarmvault) engine.

Import content from many sources (PDFs, DOCX, URLs, arXiv, YouTube, notes, code,
email — 30+ formats), **compile** it into a linked Markdown wiki + a knowledge
graph, then **ask grounded questions** with citations — all local-first and
offline by default.

> ### ⭐ Main advantage over NotebookLM: you own your data
> One click exports your **entire** notebook — original sources, the compiled
> wiki, and the knowledge graph — as open **Markdown + JSON**: full vault,
> Obsidian vault, an AI pack for any LLM, or the raw graph. No account, no
> cloud lock-in, no proprietary format. Delete this app tomorrow and your
> knowledge survives as files you can read, edit, search, and re-ingest anywhere.

- **Frontend** — React 19 · Vite 7.3 · Tailwind v4 · shadcn/ui (3-pane NotebookLM layout)
- **Backend** — Hono, a thin HTTP layer over `@swarmvaultai/engine`
- **Engine** — SwarmVault does the heavy lifting: extraction, compilation, RAG, graph, search

See **[DOCS.md](DOCS.md)** for the deep dive: implementation, full pros/cons vs
NotebookLM, and roadmap.

---

## Table of contents

- [What it does](#what-it-does)
- [How it maps to NotebookLM](#how-it-maps-to-notebooklm)
- [Why it matters — data ownership](#why-it-matters--data-ownership)
- [pros & cons vs Google NotebookLM](#pros--cons-vs-google-notebooklm)
- [Architecture](#architecture)
- [The pipeline](#the-pipeline)
- [Quickstart](#quickstart)
- [Providers](#providers)
- [Export formats](#export-formats)
- [API surface](#api-surface)
- [Testing](#testing)
- [Project layout](#project-layout)
- [License](#license)

---

## What it does

NotebookLM lets you upload sources, auto-organizes them, and answers questions
grounded in those sources. nbllmvault does the same — **import → compile →
ask** — but the whole knowledge base is plain files on disk that you fully own.

| Capability | How |
|---|---|
| **Multi-format import** | files (PDF, DOCX, XLSX, PPTX, EPUB, CSV, MD, code, audio, email, …) + URLs + pasted text |
| **Smart URL capture** | arXiv / DOI / tweet / article (Readability) / YouTube transcript |
| **Compile to wiki** | concept / entity / source / insight pages, dashboards, community summaries |
| **Knowledge graph** | typed nodes & edges, communities, god-nodes, contradiction detection |
| **Grounded chat (RAG)** | answers cite source pages; multi-turn sessions |
| **Hybrid search** | SQLite full-text + optional embeddings, reciprocal-rank fusion |
| **Wikilink navigation** | `[[page]]` links resolve and are clickable in the reader |
| **Full data export** | full vault · wiki · Obsidian · AI-pack · graph JSON |

---

## How it maps to NotebookLM

| NotebookLM | nbllmvault |
|---|---|
| Notebook | A SwarmVault **vault** (one directory per notebook) |
| Sources | `ingestInput` (files) / `addInput` (URLs, smart capture) |
| Notebook guide / notes | Compiled **wiki pages** (`compileVault`) linked by `[[wikilinks]]` |
| Chat (grounded Q&A) | `askChatSession` — RAG over the compiled wiki, with citations |
| (extra) Knowledge graph | `state/graph.json` — concepts, entities, communities |

---

## Why it matters — data ownership

NotebookLM keeps your compiled notebook **inside Google**. You can read it in
their UI, but you cannot take the *organized result* — the notes, the structure,
the graph — out in a usable, open form. nbllmvault is the opposite: the
organized result is just files, and one click hands them to you.

```
data/vaults/<notebookId>/
├── swarmvault.config.json   vault configuration
├── swarmvault.schema.md     how the wiki is structured
├── raw/                     immutable copies of every source you imported
├── wiki/                    the compiled markdown knowledge base ([[wikilinks]])
└── state/                   graph.json + search index + chat sessions
```

Everything is yours, on your disk, in open formats. See [Export formats](#export-formats).

---

## pros & cons vs Google NotebookLM

### Where nbllmvault wins

| Dimension | nbllmvault | NotebookLM |
|---|---|---|
| **Data ownership** | ✅ Files on your disk; full export in open formats | ❌ Locked in Google's cloud; no structured export |
| **Offline use** | ✅ Works fully offline (heuristic provider) | ❌ Requires Google account + internet |
| **Privacy** | ✅ Sources never leave your machine (offline mode) | ❌ Uploaded to Google |
| **Format openness** | ✅ Plain Markdown + JSON, Obsidian-compatible | ❌ Proprietary internal representation |
| **Knowledge graph** | ✅ Typed graph, communities, contradiction detection, exportable | ❌ Not exposed |
| **Extensibility** | ✅ Open source, MCP server, CLI, scriptable | ❌ Closed |
| **Self-hosting** | ✅ Yes | ❌ No |
| **Take data to other AIs** | ✅ AI-pack export feeds any LLM | ❌ Locked to Google's models |

### Where NotebookLM wins (honest)

| Dimension | NotebookLM | nbllmvault |
|---|---|---|
| **Answer quality out-of-box** | ✅ Gemini-grade synthesis by default | ⚠️ Extractive offline; needs a key for generative parity |
| **Audio Overview ("podcast")** | ✅ Signature feature | ❌ Not implemented |
| **Zero setup** | ✅ Browser + Google login | ⚠️ Needs Node ≥24 + `pnpm install` |
| **Scale / infra** | ✅ Google handles huge corpora server-side | ⚠️ Bounded by your machine |
| **Polish & multimodal** | ✅ Mature product | ⚠️ Younger UI; multimodal depends on provider |

**Summary:** NotebookLM is the smoother *product*; nbllmvault is the more
*sovereign tool*. If you value owning your data, working offline/private, an
inspectable knowledge graph, and freedom to take everything to any tool or any
AI — nbllmvault is built for that, and **export is the proof.**

---

## Architecture

```
┌──────────────┐    /api     ┌──────────────┐   function    ┌──────────────────┐
│  React SPA   │ ─────────▶ │   Hono API    │ ───calls────▶ │ @swarmvaultai/   │
│ (Vite/TW4)   │ ◀───────── │  (apps/server)│ ◀──────────── │ engine           │
└──────────────┘  JSON/zip   └──────────────┘   data/files  └──────────────────┘
                                     │
                                     ▼
                        data/vaults/<notebookId>/   ← your files, on disk
```

```
apps/
  server/   Hono API — one notebook == one vault dir under data/vaults/<id>
  web/      React + Vite 7.3 + Tailwind v4 + shadcn UI (proxies /api -> server)
data/       notebooks.json registry + per-notebook vaults (gitignored)
```

The backend holds **no knowledge-work logic of its own** — it maps HTTP routes
to engine functions, each keyed by the vault's `rootDir`. A tiny
`notebooks.json` registry tracks notebook id → name. No database.

---

## The pipeline

1. **Import** — files land in `raw/`, then `ingestInput` extracts text (30+
   formats via pdfjs, mammoth, Readability, mailparser, …). URLs use `addInput`
   for smart capture (arXiv, DOI, tweet, article, YouTube).
2. **Compile** — `compileVault` extracts concepts/entities/claims, builds a typed
   **knowledge graph**, detects communities, writes cross-linked **markdown wiki
   pages**, and a SQLite FTS search index.
3. **Ask** — `askChatSession` runs RAG over the compiled wiki and returns an
   answer **with citations** to the source pages.
4. **Export** — package any slice of the vault and download it.

---

## Quickstart

Requires **Node ≥ 24** and **pnpm**.

```bash
pnpm install
cp .env.example .env        # optional — works fully offline without keys
pnpm dev                    # starts Hono (:8799) + Vite (:5174)
```

Open <http://localhost:5174> → **New notebook** → add sources → **Compile wiki**
→ ask questions.

### Run pieces individually

```bash
pnpm dev:server   # Hono API on :8799
pnpm dev:web      # Vite dev server on :5174 (proxies /api to :8799)
```

### Production build

```bash
pnpm build        # builds web bundle + server
```

---

## Providers

- **No API key** → built-in `heuristic` provider: extractive, offline, zero network.
- **`ANTHROPIC_API_KEY`** → Claude (default `claude-opus-4-8`) for synthesis.
- **`OPENAI_API_KEY`** → OpenAI (default `gpt-4o`).

The provider is wired into each notebook's vault at creation. Keys stay in your
environment and are never written to the vault. Override the model with
`NBLLMVAULT_MODEL`.

---

## Export formats

UI: the **Export** menu in a notebook. API: `GET /api/notebooks/:id/export/:kind`.

| Export | Contents | Why |
|---|---|---|
| **Full vault** (`full`) | `raw/` + `wiki/` + `state/` + config | Complete, re-openable vault — `swarmvault next` or open in Obsidian/VS Code. Zero lock-in. |
| **Markdown wiki** (`wiki`) | just `wiki/` pages | Portable linked markdown for any editor. |
| **Obsidian vault** (`obsidian`) | graph-enriched markdown + `.obsidian/` config | Opens directly in Obsidian. |
| **AI pack** (`aipack`) | `llms.txt`, `llms-full.txt`, `graph.jsonld`, per-page, manifest | Feed **your** knowledge to any other LLM. |
| **Knowledge graph** (`graph`) | `state/graph.json` | Raw graph (nodes/edges/communities) for your own tooling. |

Exports are built in-memory (`fflate`) and streamed to the browser — nothing
leaves your machine.

---

## API surface

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

---

## Testing

```bash
node node_modules/playwright/cli.js install chromium   # once
pnpm dev                                                # in another shell
node apps/web/e2e/smoke.mjs                             # full flow
node apps/web/e2e/export.mjs                            # export download
```

- `smoke.mjs` — create notebook → add source → compile → open page → grounded chat.
- `export.mjs` — compile → open Export menu → download the full vault.

---

## Project layout

```
apps/server/src/
  config.ts           paths, port, limits
  notebooks.ts        notebook registry (notebooks.json) ↔ vault dirs
  engine-service.ts   thin wrappers over the engine (+ optional provider wiring)
  export-service.ts   ★ data-ownership exports
  routes.ts           Hono routes
  index.ts            server entry (CORS, logger)

apps/web/src/
  lib/api.ts          typed API client (+ export download)
  views/HomeView.tsx          notebook grid
  views/NotebookView.tsx      3-pane workspace + Export menu
  views/panels/SourcesPanel   import (file/URL/paste) + compile
  views/panels/ReaderPanel    wiki page list + markdown reader + wikilinks
  views/panels/ChatPanel      grounded RAG chat with citations
  components/ui/*             shadcn primitives
```

---

## License

MIT. SwarmVault is MIT-licensed by swarmclawai.
