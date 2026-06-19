import { Hono } from "hono";
import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "./config.js";
import * as engine from "./engine-service.js";
import { type ExportKind, exportNotebook } from "./export-service.js";
import {
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  touchNotebook,
  updateNotebook,
} from "./notebooks.js";

export const api = new Hono();

// ---- helpers ----------------------------------------------------------------

async function requireNotebook(id: string) {
  const nb = await getNotebook(id);
  if (!nb) return null;
  return nb;
}

// ---- notebooks --------------------------------------------------------------

api.get("/notebooks", async (c) => {
  return c.json({ notebooks: await listNotebooks() });
});

api.post("/notebooks", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ name: z.string().optional() }).safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const nb = await createNotebook(parsed.data.name ?? "Untitled notebook");
  await engine.ensureNotebookVault(nb.id);
  return c.json({ notebook: nb }, 201);
});

api.get("/notebooks/:id", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const info = await engine.workspaceInfo(nb.id);
  return c.json({ notebook: nb, info });
});

api.patch("/notebooks/:id", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ name: z.string() }).safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const updated = await updateNotebook(nb.id, { name: parsed.data.name });
  return c.json({ notebook: updated });
});

api.delete("/notebooks/:id", async (c) => {
  const ok = await deleteNotebook(c.req.param("id"));
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

// ---- sources / import -------------------------------------------------------

api.get("/notebooks/:id/sources", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  return c.json({ sources: await engine.listSources(nb.id) });
});

api.post("/notebooks/:id/sources/file", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) return c.json({ error: "missing file" }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "file too large" }, 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const result = await engine.importFile(nb.id, file.name, bytes);
    await touchNotebook(nb.id);
    return c.json({ source: result }, 201);
  } catch (err) {
    return c.json({ error: errMsg(err) }, 500);
  }
});

api.post("/notebooks/:id/sources/url", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ url: z.string().url() }).safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid url" }, 400);
  try {
    const result = await engine.importUrl(nb.id, parsed.data.url);
    await touchNotebook(nb.id);
    return c.json({ source: result }, 201);
  } catch (err) {
    return c.json({ error: errMsg(err) }, 500);
  }
});

api.post("/notebooks/:id/sources/text", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ title: z.string().optional(), text: z.string().min(1) })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  try {
    const result = await engine.importText(
      nb.id,
      parsed.data.title ?? "Note",
      parsed.data.text
    );
    await touchNotebook(nb.id);
    return c.json({ source: result }, 201);
  } catch (err) {
    return c.json({ error: errMsg(err) }, 500);
  }
});

// ---- compile ----------------------------------------------------------------

api.post("/notebooks/:id/compile", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  try {
    const summary = await engine.compile(nb.id);
    await updateNotebook(nb.id, { compiledAt: new Date().toISOString() });
    return c.json({ compile: summary });
  } catch (err) {
    return c.json({ error: errMsg(err) }, 500);
  }
});

// ---- pages ------------------------------------------------------------------

api.get("/notebooks/:id/pages", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  return c.json({ pages: await engine.pages(nb.id) });
});

api.get("/notebooks/:id/page", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const rel = c.req.query("path");
  if (!rel) return c.json({ error: "missing path" }, 400);
  const result = await engine.page(nb.id, rel);
  if (!result) return c.json({ error: "page not found" }, 404);
  return c.json({ page: result });
});

// ---- search -----------------------------------------------------------------

api.get("/notebooks/:id/search", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const q = c.req.query("q") ?? "";
  if (!q.trim()) return c.json({ results: [] });
  const limit = Number(c.req.query("limit") ?? 8);
  try {
    return c.json({ results: await engine.search(nb.id, q, limit) });
  } catch (err) {
    return c.json({ error: errMsg(err) }, 500);
  }
});

// ---- chat (RAG) -------------------------------------------------------------

api.post("/notebooks/:id/chat", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ question: z.string().min(1), sessionId: z.string().optional() })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  try {
    const answer = await engine.ask(nb.id, parsed.data.question, parsed.data.sessionId);
    return c.json({ answer });
  } catch (err) {
    return c.json({ error: errMsg(err) }, 500);
  }
});

api.get("/notebooks/:id/chat/sessions", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  return c.json({ sessions: await engine.chatSessions(nb.id) });
});

api.get("/notebooks/:id/chat/sessions/:sessionId", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  try {
    const session = await engine.chatSession(nb.id, c.req.param("sessionId"));
    return c.json({ session });
  } catch (err) {
    return c.json({ error: errMsg(err) }, 404);
  }
});

// ---- export (data ownership) ------------------------------------------------

const EXPORT_KINDS: ExportKind[] = ["full", "wiki", "obsidian", "graph", "aipack"];

api.get("/notebooks/:id/export/:kind", async (c) => {
  const nb = await requireNotebook(c.req.param("id"));
  if (!nb) return c.json({ error: "not found" }, 404);
  const kind = c.req.param("kind") as ExportKind;
  if (!EXPORT_KINDS.includes(kind)) {
    return c.json({ error: `invalid export kind; use one of ${EXPORT_KINDS.join(", ")}` }, 400);
  }
  try {
    const result = await exportNotebook(nb.id, kind, nb.name);
    c.header("Content-Type", result.contentType);
    c.header("Content-Disposition", `attachment; filename="${result.filename}"`);
    c.header("Content-Length", String(result.bytes.byteLength));
    // Copy into a standalone ArrayBuffer for the response body.
    const ab = result.bytes.buffer.slice(
      result.bytes.byteOffset,
      result.bytes.byteOffset + result.bytes.byteLength
    ) as ArrayBuffer;
    return c.body(ab);
  } catch (err) {
    return c.json({ error: errMsg(err) }, 500);
  }
});

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
