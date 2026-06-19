import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { exportAiPack, exportObsidianVault } from "@swarmvaultai/engine";
import { zipSync, type Zippable } from "fflate";
import { vaultDir } from "./notebooks.js";

/**
 * Data-ownership exports. The whole point of nbllmvault vs. a closed SaaS:
 * the user can take everything with them, anytime, in open formats.
 *
 * Every export builds an in-memory zip with fflate (pure JS, no native deps)
 * and returns the bytes + a filename. The caller streams them to the client.
 */

export type ExportKind = "full" | "wiki" | "obsidian" | "graph" | "aipack";

export interface ExportResult {
  filename: string;
  bytes: Uint8Array;
  contentType: string;
}

const SKIP_DIRS = new Set(["node_modules", ".git"]);

/** Recursively collect files under `dir` into a flat path->bytes map. */
async function collectDir(dir: string, prefix = ""): Promise<Zippable> {
  const out: Zippable = {};
  if (!existsSync(dir)) return out;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(out, await collectDir(abs, rel));
    } else if (entry.isFile()) {
      const info = await stat(abs);
      // Guard against absurdly large single files (>200MB) to protect memory.
      if (info.size > 200 * 1024 * 1024) continue;
      out[rel] = new Uint8Array(await readFile(abs));
    }
  }
  return out;
}

/** Collect only a named sub-directory of the vault. */
async function collectSub(root: string, sub: string, label: string): Promise<Zippable> {
  const dir = path.join(root, sub);
  const files = await collectDir(dir, label);
  return files;
}

export async function exportNotebook(
  id: string,
  kind: ExportKind,
  notebookName: string
): Promise<ExportResult> {
  const root = vaultDir(id);
  if (!existsSync(root)) throw new Error("notebook vault not found");
  const safeName = slug(notebookName) || id.slice(0, 8);

  switch (kind) {
    case "full":
      return zipResult(`${safeName}-vault`, await collectFullVault(root));
    case "wiki":
      return zipResult(`${safeName}-wiki`, await collectWiki(root));
    case "graph":
      return graphExport(root, safeName);
    case "obsidian":
      return obsidianExport(root, safeName);
    case "aipack":
      return aiPackExport(root, safeName);
    default:
      throw new Error(`unknown export kind: ${kind}`);
  }
}

/** Full, re-openable vault: config + schema + raw + wiki + state. */
async function collectFullVault(root: string): Promise<Zippable> {
  const files: Zippable = {};
  for (const sub of ["raw", "wiki", "state", "agent"]) {
    Object.assign(files, await collectSub(root, sub, sub));
  }
  // Top-level config + schema files live directly under root.
  const top = await readdir(root, { withFileTypes: true });
  for (const e of top) {
    if (e.isFile()) {
      files[e.name] = new Uint8Array(await readFile(path.join(root, e.name)));
    }
  }
  files["EXPORT.md"] = enc(fullVaultReadme());
  return files;
}

/** Just the compiled markdown wiki — portable knowledge, any editor. */
async function collectWiki(root: string): Promise<Zippable> {
  const files = await collectSub(root, "wiki", "wiki");
  files["README.md"] = enc(wikiReadme());
  return files;
}

/** state/graph.json plus any graph report. */
async function graphExport(root: string, name: string): Promise<ExportResult> {
  const graphPath = path.join(root, "state", "graph.json");
  if (!existsSync(graphPath)) throw new Error("no compiled graph — compile the notebook first");
  const bytes = new Uint8Array(await readFile(graphPath));
  return {
    filename: `${name}-graph.json`,
    bytes,
    contentType: "application/json",
  };
}

/** Obsidian-ready vault via the engine, then zipped. */
async function obsidianExport(root: string, name: string): Promise<ExportResult> {
  const tmp = await mkdtemp(path.join(tmpdir(), "nbllm-obsidian-"));
  try {
    // Engine signature: exportObsidianVault(rootDir, outputDir)
    await (exportObsidianVault as any)(root, tmp);
    const files = await collectDir(tmp);
    if (Object.keys(files).length === 0) {
      throw new Error("obsidian export produced no files — compile the notebook first");
    }
    return zipResult(`${name}-obsidian`, files);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/**
 * AI pack: llms.txt + llms-full.txt + graph.jsonld + per-page text/json — a
 * portable bundle you can feed to ANY other LLM (ChatGPT, Claude, local models).
 * Take your knowledge to any AI, not just this app.
 */
async function aiPackExport(root: string, name: string): Promise<ExportResult> {
  const tmp = await mkdtemp(path.join(tmpdir(), "nbllm-aipack-"));
  try {
    await (exportAiPack as any)(root, { outDir: tmp });
    const files = await collectDir(tmp);
    if (Object.keys(files).length === 0) {
      throw new Error("AI pack produced no files — compile the notebook first");
    }
    return zipResult(`${name}-aipack`, files);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

function zipResult(stem: string, files: Zippable): ExportResult {
  if (Object.keys(files).length === 0) {
    throw new Error("nothing to export — add sources and compile first");
  }
  const bytes = zipSync(files, { level: 6 });
  return {
    filename: `${stem}.zip`,
    bytes,
    contentType: "application/zip",
  };
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function fullVaultReadme(): string {
  return `# nbllmvault — full vault export

This is a complete, self-contained SwarmVault vault. You own this data outright.

## Contents
- \`swarmvault.config.json\` / \`swarmvault.schema.md\` — vault configuration
- \`raw/\` — immutable copies of every source you imported
- \`wiki/\` — the compiled markdown knowledge base (linked by [[wikilinks]])
- \`state/\` — knowledge graph (graph.json), search index, sessions

## Re-open it anywhere
This folder works directly with the open-source SwarmVault CLI:

\`\`\`bash
npm install -g @swarmvaultai/cli
cd this-folder
swarmvault next
swarmvault graph serve
\`\`\`

Or open \`wiki/\` in Obsidian, VS Code, or any markdown editor.

No lock-in. No proprietary format. No account required.
`;
}

function wikiReadme(): string {
  return `# nbllmvault — wiki export

Portable markdown knowledge base. Every page is plain Markdown with YAML
frontmatter; cross-references use Obsidian-style [[wikilinks]].

Open this folder in Obsidian, VS Code, Logseq, or any markdown tool. Your data,
your format, forever.
`;
}
