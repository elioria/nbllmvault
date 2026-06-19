# nbllmvault — Detailed Documentation

A local-first, open clone of **Google NotebookLM**, built on the open-source
[SwarmVault](https://github.com/swarmclawai/swarmvault) engine.

> **The one thing that matters most:** *you own your data and can export all of
> it, anytime, in open formats.* Everything below is in service of that.

---

## 1. What this is

NotebookLM lets you upload sources, auto-organizes them, and answers questions
grounded in those sources. nbllmvault does the same — **import → compile →
ask** — but the entire knowledge base lives as plain files on disk that you can
take with you. No account. No cloud lock-in. No proprietary format.

| | |
|---|---|
| **Purpose** | Turn scattered material (PDFs, URLs, papers, notes, code, transcripts) into a connected, queryable knowledge base you fully own. |
| **Model** | One *notebook* = one *vault directory*. Sources, compiled wiki, graph, and search index are all files inside it. |
| **Frontend** | React 19 · Vite 7.3 · Tailwind v4 · shadcn/ui — a 3-pane NotebookLM-style workspace. |
| **Backend** | Hono — a thin HTTP layer over `@swarmvaultai/engine`. |
| **Engine** | SwarmVault — extraction, compilation, RAG, knowledge graph, search. |

---

## 2. How it works (implementation)

### 2.1 Architecture

```
┌──────────────┐    /api     ┌──────────────┐   function    ┌──────────────────┐
│  React SPA   │ ─────────▶ │   Hono API    │ ───calls────▶ │ @swarmvaultai/   │
│ (Vite/TW4)   │ ◀───────── │  (apps/server)│ ◀──────────── │ engine           │
└──────────────┘   JSON/zip  └──────────────┘   data/files  └──────────────────┘
                                     │
                                     ▼
                        data/vaults/<notebookId>/   ← your files, on disk
                          ├── swarmvault.config.json
                          ├── swarmvault.schema.md
                          ├── raw/      immutable source copies
                          ├── wiki/     compiled markdown (linked by [[wikilinks]])
                          └── state/    graph.json + search index + sessions
```

The backend holds **no business logic of its own** for knowledge work — it maps
HTTP routes to engine functions, each keyed by the vault's `rootDir`. A tiny
`notebooks.json` registry tracks notebook id → name. No database.

### 2.2 The pipeline (what happens to your data)

1. **Import** — files go to `raw/` then `ingestInput` extracts text (30+ formats
   via pdfjs, mammoth, readability, mailparser, etc.). URLs use `addInput` for
   smart capture (arXiv metadata, DOI, tweet, article readability, YouTube
   transcript).
2. **Compile** — `compileVault` analyzes sources, extracts concepts/entities/
   claims, builds a typed **knowledge graph**, detects communities, and writes
   **markdown wiki pages** cross-linked with `[[wikilinks]]`, plus a SQLite FTS
   search index. Three-layer model (Karpathy's LLM-Wiki): raw → wiki → schema.
3. **Ask** — `askChatSession` runs RAG over the compiled wiki and returns an
   answer **with citations** back to the source pages.
4. **Export** — package any slice of the vault and download it (see §4).

### 2.3 Providers (the LLM)

- **Offline by default** — SwarmVault's built-in `heuristic` provider runs with
  zero network and zero keys. Answers are *extractive* (pulls the most relevant
  compiled passages).
- **Optional cloud** — set `ANTHROPIC_API_KEY` (Claude, default
  `claude-opus-4-8`) or `OPENAI_API_KEY` (default `gpt-4o`) and new notebooks
  get *generative* synthesis. Keys stay in your environment; they are never
  written to the vault (engine references them via `apiKeyEnv`).

---

## 3. Functionality

| Capability | How |
|---|---|
| Multi-format import | files (PDF/DOCX/XLSX/PPTX/EPUB/CSV/MD/code/audio/email/…) + URLs + pasted text |
| Smart URL capture | arXiv / DOI / tweet / article / YouTube |
| Compile to wiki | concept/entity/source/insight pages, dashboards, community summaries |
| Knowledge graph | typed nodes & edges, communities, god-nodes, contradictions |
| Grounded chat (RAG) | answers cite source pages; multi-turn sessions |
| Hybrid search | SQLite full-text + optional embeddings, reciprocal-rank fusion |
| Wikilink navigation | `[[page]]` links resolve and are clickable in the reader |
| **Full data export** | full vault / wiki / Obsidian / AI-pack / graph JSON |

---

## 4. Data ownership & export — the headline feature

NotebookLM keeps your compiled notebook **inside Google**. You can read it in
their UI, but you cannot take the *organized* result — the notes, the structure,
the graph — out in a usable, open form. nbllmvault is the opposite: the
organized result is just files, and one click hands them to you.

Five export modes (UI: **Export** menu; API: `GET /api/notebooks/:id/export/:kind`):

| Export | Contents | Why it matters |
|---|---|---|
| **Full vault** (`full`) | `raw/` + `wiki/` + `state/` + config | Complete, re-openable vault. Run `swarmvault next` on it, or open in Obsidian/VS Code. **Zero lock-in.** |
| **Markdown wiki** (`wiki`) | just `wiki/` pages | Portable linked knowledge for any markdown tool. |
| **Obsidian vault** (`obsidian`) | graph-enriched markdown + `.obsidian/` config | Opens directly in Obsidian with graph metadata. |
| **AI pack** (`aipack`) | `llms.txt`, `llms-full.txt`, `graph.jsonld`, per-page text/json, `manifest.json` | Feed *your* knowledge to **any other LLM** (ChatGPT, Claude, local models). Not locked to this app's AI either. |
| **Knowledge graph** (`graph`) | `state/graph.json` | Raw graph (nodes/edges/communities) for your own tooling, Neo4j, etc. |

Exports are built in-memory with `fflate` (pure-JS zip) and streamed to the
browser — nothing leaves your machine. Every bundle includes a README
explaining how to re-open it elsewhere.

**Practical guarantee:** delete this app tomorrow and your knowledge survives as
open Markdown + JSON you can read, edit, search, and re-ingest anywhere.

---

## 5. Pros & cons vs Google NotebookLM

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
| **Cost control** | ✅ Free offline; bring-your-own API key | ⚠️ Free tier with Google's limits/quotas |
| **Take data to other AIs** | ✅ AI-pack export feeds any LLM | ❌ Locked to Google's models |

### Where NotebookLM wins (honest cons)

| Dimension | NotebookLM | nbllmvault |
|---|---|---|
| **Answer quality out-of-box** | ✅ Gemini-grade synthesis by default | ⚠️ Extractive offline; needs a key for generative parity |
| **Audio Overview ("podcast")** | ✅ Signature feature | ❌ Not implemented (engine has local-whisper for *input* transcription, not TTS output) |
| **Zero setup** | ✅ Just a browser + Google login | ⚠️ Needs Node ≥24 + `pnpm install` (or self-host) |
| **Scale / infra** | ✅ Google handles huge corpora server-side | ⚠️ Bounded by your machine (the engine has large-repo modes, but it's local) |
| **Polish & multimodal** | ✅ Mature product, video/image understanding | ⚠️ Younger UI; multimodal depends on configured provider |
| **Collaboration** | ✅ Sharing built in | ⚠️ Via git/file-sharing, not real-time |

### Summary

NotebookLM is the smoother **product**; nbllmvault is the more **sovereign
tool**. If you value polish and Google's models and don't mind the cloud, use
NotebookLM. If you value owning your data, working offline/private, an inspectable
knowledge graph, and the freedom to take everything to any tool or any AI —
nbllmvault is built for that, and **export is the proof**.

---

## 6. Limitations & roadmap

- **Generative answers need a key.** Offline is extractive. (Mitigation: set an
  API key; or point the engine at a local Ollama model.)
- **No Audio Overview.** Could be added with a TTS provider over the
  AI-pack/wiki content.
- **Single-user, local.** Multi-user/real-time collaboration is out of scope;
  use git on the vault directory.
- **Import is synchronous.** Very large corpora block the request; a job queue
  would improve UX (engine supports resumable ingest under the hood).

---

## 7. File map

```
apps/server/src/
  config.ts           paths, port, limits
  notebooks.ts        notebook registry (notebooks.json) ↔ vault dirs
  engine-service.ts   thin wrappers over the engine (+ optional provider wiring)
  export-service.ts   ★ data-ownership exports (full/wiki/obsidian/aipack/graph)
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
