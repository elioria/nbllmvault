import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REGISTRY_PATH, VAULTS_DIR } from "./config.js";

export interface Notebook {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
  updatedAt: string;
  /** Last successful compile timestamp, if any. */
  compiledAt?: string;
}

interface Registry {
  notebooks: Notebook[];
}

const EMOJIS = ["📓", "📘", "📗", "📙", "📕", "🗂️", "🧠", "🔬", "📚", "🗃️"];

async function ensureDirs(): Promise<void> {
  await mkdir(VAULTS_DIR, { recursive: true });
  await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
}

async function readRegistry(): Promise<Registry> {
  await ensureDirs();
  try {
    const raw = await readFile(REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw) as Registry;
    if (!Array.isArray(parsed.notebooks)) return { notebooks: [] };
    return parsed;
  } catch {
    return { notebooks: [] };
  }
}

async function writeRegistry(reg: Registry): Promise<void> {
  await ensureDirs();
  await writeFile(REGISTRY_PATH, JSON.stringify(reg, null, 2), "utf8");
}

/** Absolute path to a notebook's vault directory (= engine rootDir). */
export function vaultDir(id: string): string {
  return path.join(VAULTS_DIR, id);
}

export async function listNotebooks(): Promise<Notebook[]> {
  const reg = await readRegistry();
  return reg.notebooks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getNotebook(id: string): Promise<Notebook | undefined> {
  const reg = await readRegistry();
  return reg.notebooks.find((n) => n.id === id);
}

export async function createNotebook(name: string): Promise<Notebook> {
  const reg = await readRegistry();
  const now = new Date().toISOString();
  const nb: Notebook = {
    id: randomUUID(),
    name: name.trim() || "Untitled notebook",
    emoji: EMOJIS[reg.notebooks.length % EMOJIS.length],
    createdAt: now,
    updatedAt: now,
  };
  reg.notebooks.push(nb);
  await writeRegistry(reg);
  await mkdir(vaultDir(nb.id), { recursive: true });
  return nb;
}

export async function updateNotebook(
  id: string,
  patch: Partial<Pick<Notebook, "name" | "compiledAt">>
): Promise<Notebook | undefined> {
  const reg = await readRegistry();
  const nb = reg.notebooks.find((n) => n.id === id);
  if (!nb) return undefined;
  if (patch.name !== undefined) nb.name = patch.name.trim() || nb.name;
  if (patch.compiledAt !== undefined) nb.compiledAt = patch.compiledAt;
  nb.updatedAt = new Date().toISOString();
  await writeRegistry(reg);
  return nb;
}

export async function deleteNotebook(id: string): Promise<boolean> {
  const reg = await readRegistry();
  const before = reg.notebooks.length;
  reg.notebooks = reg.notebooks.filter((n) => n.id !== id);
  if (reg.notebooks.length === before) return false;
  await writeRegistry(reg);
  // Best-effort vault removal.
  try {
    const { rm } = await import("node:fs/promises");
    await rm(vaultDir(id), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return true;
}

/** Touch updatedAt without other changes. */
export async function touchNotebook(id: string): Promise<void> {
  await updateNotebook(id, {});
}
