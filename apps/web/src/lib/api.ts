export interface Notebook {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
  updatedAt: string;
  compiledAt?: string;
}

export interface WorkspaceInfo {
  sourceCount: number;
  pageCount: number;
}

export interface Source {
  sourceId: string;
  title: string;
  sourceKind: string;
  sourceClass?: string;
  url?: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
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

export interface PageDetail {
  path: string;
  title: string;
  frontmatter: unknown;
  content: string;
}

export interface SearchHit {
  pageId: string;
  path: string;
  title: string;
  kind: string;
  snippet?: string;
  score: number;
}

export interface ChatAnswer {
  sessionId: string;
  question: string;
  answer: string;
  citations: unknown[];
  relatedPageIds: string[];
}

export interface CompileSummary {
  changedPages: number;
  pageCount: number;
  sourceCount: number;
}

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const api = {
  listNotebooks: () => req<{ notebooks: Notebook[] }>("/notebooks").then((r) => r.notebooks),

  createNotebook: (name: string) =>
    req<{ notebook: Notebook }>("/notebooks", json({ name })).then((r) => r.notebook),

  getNotebook: (id: string) =>
    req<{ notebook: Notebook; info: WorkspaceInfo }>(`/notebooks/${id}`),

  renameNotebook: (id: string, name: string) =>
    req<{ notebook: Notebook }>(`/notebooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => r.notebook),

  deleteNotebook: (id: string) =>
    req<{ ok: boolean }>(`/notebooks/${id}`, { method: "DELETE" }),

  listSources: (id: string) =>
    req<{ sources: Source[] }>(`/notebooks/${id}/sources`).then((r) => r.sources),

  importUrl: (id: string, url: string) =>
    req<{ source: Source }>(`/notebooks/${id}/sources/url`, json({ url })).then((r) => r.source),

  importText: (id: string, title: string, text: string) =>
    req<{ source: Source }>(`/notebooks/${id}/sources/text`, json({ title, text })).then(
      (r) => r.source
    ),

  importFile: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return req<{ source: Source }>(`/notebooks/${id}/sources/file`, {
      method: "POST",
      body: form,
    }).then((r) => r.source);
  },

  compile: (id: string) =>
    req<{ compile: CompileSummary }>(`/notebooks/${id}/compile`, { method: "POST" }).then(
      (r) => r.compile
    ),

  listPages: (id: string) =>
    req<{ pages: Page[] }>(`/notebooks/${id}/pages`).then((r) => r.pages),

  readPage: (id: string, path: string) =>
    req<{ page: PageDetail }>(`/notebooks/${id}/page?path=${encodeURIComponent(path)}`).then(
      (r) => r.page
    ),

  search: (id: string, q: string) =>
    req<{ results: SearchHit[] }>(`/notebooks/${id}/search?q=${encodeURIComponent(q)}`).then(
      (r) => r.results
    ),

  chat: (id: string, question: string, sessionId?: string) =>
    req<{ answer: ChatAnswer }>(`/notebooks/${id}/chat`, json({ question, sessionId })).then(
      (r) => r.answer
    ),

  /** Download an export. Triggers a browser file save. */
  exportNotebook: async (id: string, kind: ExportKind) => {
    const res = await fetch(`${BASE}/notebooks/${id}/export/${kind}`);
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        msg = (await res.json())?.error ?? msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `export-${kind}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export type ExportKind = "full" | "wiki" | "obsidian" | "graph" | "aipack";
