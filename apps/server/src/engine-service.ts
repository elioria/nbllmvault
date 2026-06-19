import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  addInput,
  addProviderConfig,
  askChatSession,
  compileVault,
  getWorkspaceInfo,
  initVault,
  ingestInput,
  listChatSessions,
  listManifests,
  listPages,
  readChatSession,
  readPage,
  searchVault,
} from "@swarmvaultai/engine";
import { vaultDir } from "./notebooks.js";

/**
 * Thin service layer over the SwarmVault engine. Each notebook id maps to a
 * vault directory; every engine call is keyed by that rootDir.
 *
 * All engine types are intentionally loose (`any`) at this boundary — the engine
 * ships rich types but we only forward JSON-serialisable subsets to the client.
 */

async function ensureVault(id: string): Promise<string> {
  const dir = vaultDir(id);
  await mkdir(dir, { recursive: true });
  // initVault is idempotent: it only writes config/schema if missing.
  if (!existsSync(path.join(dir, "swarmvault.config.json"))) {
    await initVault(dir, {});
    await maybeConfigureCloudProvider(dir);
  }
  return dir;
}

/**
 * If an LLM API key is present in the environment, wire a cloud provider into
 * the vault for richer synthesis. With no key, the vault keeps the built-in
 * offline `heuristic` provider — the whole app still works, just extractively.
 */
async function maybeConfigureCloudProvider(dir: string): Promise<void> {
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      await addProviderConfig({
        rootDir: dir,
        providerId: "anthropic",
        provider: {
          type: "anthropic",
          model: process.env.NBLLMVAULT_MODEL ?? "claude-opus-4-8",
          apiKeyEnv: "ANTHROPIC_API_KEY",
          capabilities: ["chat", "structured", "vision"],
        },
        tasks: ["queryProvider", "compileProvider", "lintProvider", "visionProvider"],
      } as any);
    } else if (process.env.OPENAI_API_KEY) {
      await addProviderConfig({
        rootDir: dir,
        providerId: "openai",
        provider: {
          type: "openai",
          model: process.env.NBLLMVAULT_MODEL ?? "gpt-4o",
          apiKeyEnv: "OPENAI_API_KEY",
          capabilities: ["chat", "structured", "vision"],
        },
        tasks: ["queryProvider", "compileProvider", "lintProvider", "visionProvider"],
      } as any);
    }
  } catch {
    // Non-fatal: fall back to the offline heuristic provider.
  }
}

export async function ensureNotebookVault(id: string): Promise<void> {
  await ensureVault(id);
}

/** Persist an uploaded file into the vault's raw/ dir and ingest it. */
export async function importFile(
  id: string,
  filename: string,
  bytes: Buffer
): Promise<{ title: string; sourceId: string; sourceKind: string }> {
  const dir = await ensureVault(id);
  const rawDir = path.join(dir, "raw");
  await mkdir(rawDir, { recursive: true });
  const safe = sanitizeFilename(filename);
  const dest = path.join(rawDir, safe);
  await writeFile(dest, bytes);
  const manifest = (await ingestInput(dir, dest)) as any;
  return {
    title: manifest.title,
    sourceId: manifest.sourceId,
    sourceKind: manifest.sourceKind,
  };
}

/** Import raw pasted text as a markdown source. */
export async function importText(
  id: string,
  title: string,
  text: string
): Promise<{ title: string; sourceId: string; sourceKind: string }> {
  const dir = await ensureVault(id);
  const rawDir = path.join(dir, "raw");
  await mkdir(rawDir, { recursive: true });
  const base = sanitizeFilename(title || "note");
  const fname = base.endsWith(".md") ? base : `${base}.md`;
  const dest = path.join(rawDir, fname);
  const body = title ? `# ${title}\n\n${text}\n` : `${text}\n`;
  await writeFile(dest, body, "utf8");
  const manifest = (await ingestInput(dir, dest)) as any;
  return {
    title: manifest.title,
    sourceId: manifest.sourceId,
    sourceKind: manifest.sourceKind,
  };
}

/** Import a URL with smart capture (arXiv / DOI / tweet / article). */
export async function importUrl(
  id: string,
  url: string
): Promise<{ title: string; sourceId: string; sourceKind: string; captureType: string }> {
  const dir = await ensureVault(id);
  const result = (await addInput(dir, url, {})) as any;
  const manifest = result.manifest;
  return {
    title: manifest.title,
    sourceId: manifest.sourceId,
    sourceKind: manifest.sourceKind,
    captureType: result.captureType,
  };
}

export interface SourceSummary {
  sourceId: string;
  title: string;
  sourceKind: string;
  sourceClass?: string;
  url?: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export async function listSources(id: string): Promise<SourceSummary[]> {
  const dir = await ensureVault(id);
  const manifests = (await listManifests(dir)) as any[];
  return manifests.map((m) => ({
    sourceId: m.sourceId,
    title: m.title,
    sourceKind: m.sourceKind,
    sourceClass: m.sourceClass,
    url: m.url,
    mimeType: m.mimeType,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));
}

export interface CompileSummary {
  changedPages: number;
  pageCount: number;
  sourceCount: number;
}

export async function compile(id: string): Promise<CompileSummary> {
  const dir = await ensureVault(id);
  const res = (await compileVault(dir, {})) as any;
  const info = (await getWorkspaceInfo(dir)) as any;
  return {
    changedPages: Array.isArray(res.changedPages) ? res.changedPages.length : 0,
    pageCount: info.pageCount ?? 0,
    sourceCount: info.sourceCount ?? 0,
  };
}

export interface PageSummary {
  id: string;
  path: string;
  title: string;
  kind: string;
  status: string;
  sourceIds: string[];
  relatedPageIds: string[];
  confidence: number;
  updatedAt: string;
}

export async function pages(id: string): Promise<PageSummary[]> {
  const dir = await ensureVault(id);
  const list = (await listPages(dir)) as any[];
  return list.map((p) => ({
    id: p.id,
    path: p.path,
    title: p.title,
    kind: p.kind,
    status: p.status,
    sourceIds: p.sourceIds ?? [],
    relatedPageIds: p.relatedPageIds ?? [],
    confidence: p.confidence ?? 0,
    updatedAt: p.updatedAt,
  }));
}

export async function page(
  id: string,
  relPath: string
): Promise<{ path: string; title: string; frontmatter: unknown; content: string } | null> {
  const dir = await ensureVault(id);
  const result = (await readPage(dir, relPath)) as any;
  if (!result) return null;
  return {
    path: result.path,
    title: result.title,
    frontmatter: result.frontmatter,
    content: result.content,
  };
}

export interface SearchHit {
  pageId: string;
  path: string;
  title: string;
  kind: string;
  snippet?: string;
  score: number;
}

export async function search(id: string, query: string, limit = 8): Promise<SearchHit[]> {
  const dir = await ensureVault(id);
  const hits = (await searchVault(dir, query, limit)) as any[];
  return hits.map((h) => ({
    pageId: h.pageId ?? h.id,
    path: h.path,
    title: h.title,
    kind: h.kind,
    snippet: h.snippet,
    score: h.score ?? 0,
  }));
}

export interface ChatAnswer {
  sessionId: string;
  question: string;
  answer: string;
  citations: unknown[];
  relatedPageIds: string[];
}

export async function ask(
  id: string,
  question: string,
  sessionId?: string
): Promise<ChatAnswer> {
  const dir = await ensureVault(id);
  const res = (await askChatSession(dir, {
    question,
    sessionId,
  } as any)) as any;
  const turn = res.turn ?? {};
  return {
    sessionId: res.session?.id ?? res.session?.sessionId ?? sessionId ?? "",
    question: turn.question ?? question,
    answer: turn.answer ?? res.answer ?? "",
    citations: turn.citations ?? [],
    relatedPageIds: turn.relatedPageIds ?? [],
  };
}

export async function chatSessions(id: string): Promise<unknown[]> {
  const dir = await ensureVault(id);
  return (await listChatSessions(dir)) as unknown[];
}

export async function chatSession(id: string, sessionId: string): Promise<unknown> {
  const dir = await ensureVault(id);
  return (await readChatSession(dir, sessionId)) as unknown;
}

export async function workspaceInfo(id: string): Promise<{ sourceCount: number; pageCount: number }> {
  const dir = await ensureVault(id);
  const info = (await getWorkspaceInfo(dir)) as any;
  return { sourceCount: info.sourceCount ?? 0, pageCount: info.pageCount ?? 0 };
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "file";
}
