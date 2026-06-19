import {
  ArrowLeft,
  Brain,
  Download,
  FileArchive,
  FileJson,
  Loader2,
  Package,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { navigate } from "@/App";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type ExportKind, type Notebook, type Page, type Source } from "@/lib/api";
import { ChatPanel } from "./panels/ChatPanel";
import { ReaderPanel } from "./panels/ReaderPanel";
import { SourcesPanel } from "./panels/SourcesPanel";

export function NotebookView({ notebookId }: { notebookId: string }) {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const loadSources = useCallback(async () => {
    setSources(await api.listSources(notebookId));
  }, [notebookId]);

  const loadPages = useCallback(async () => {
    try {
      setPages(await api.listPages(notebookId));
    } catch {
      setPages([]);
    }
  }, [notebookId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { notebook } = await api.getNotebook(notebookId);
        if (cancelled) return;
        setNotebook(notebook);
        await Promise.all([loadSources(), loadPages()]);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notebookId, loadSources, loadPages]);

  async function compile() {
    setCompiling(true);
    try {
      const res = await api.compile(notebookId);
      await loadPages();
      setToast(`Compiled · ${res.pageCount} pages from ${res.sourceCount} sources`);
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
      setTimeout(() => setToast(null), 5000);
    } finally {
      setCompiling(false);
    }
  }

  async function doExport(kind: ExportKind) {
    setExporting(kind);
    try {
      await api.exportNotebook(notebookId, kind);
      setToast("Export downloaded — your data, your files.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (notFound) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <p className="mb-3 text-muted-foreground">Notebook not found.</p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" /> Back to notebooks
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <Brain className="h-5 w-5 text-primary" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">
            {notebook ? `${notebook.emoji} ${notebook.name}` : "Loading…"}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="muted">{sources.length} sources</Badge>
          <Badge variant="muted">{pages.length} pages</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!!exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Take your data with you</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => doExport("full")}>
                <FileArchive className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">Full vault (.zip)</div>
                  <div className="text-xs text-muted-foreground">
                    Everything — raw sources, wiki, graph, config. Re-openable in SwarmVault.
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => doExport("wiki")}>
                <Package className="mt-0.5 h-4 w-4 text-emerald-400" />
                <div>
                  <div className="font-medium">Markdown wiki (.zip)</div>
                  <div className="text-xs text-muted-foreground">
                    Portable linked markdown for any editor.
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => doExport("obsidian")}>
                <Package className="mt-0.5 h-4 w-4 text-violet-400" />
                <div>
                  <div className="font-medium">Obsidian vault (.zip)</div>
                  <div className="text-xs text-muted-foreground">
                    Graph-enriched, opens directly in Obsidian.
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => doExport("aipack")}>
                <Sparkles className="mt-0.5 h-4 w-4 text-amber-400" />
                <div>
                  <div className="font-medium">AI pack (.zip)</div>
                  <div className="text-xs text-muted-foreground">
                    llms.txt + JSON-LD to feed any other LLM.
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => doExport("graph")}>
                <FileJson className="mt-0.5 h-4 w-4 text-orange-400" />
                <div>
                  <div className="font-medium">Knowledge graph (.json)</div>
                  <div className="text-xs text-muted-foreground">
                    Raw graph — nodes, edges, communities.
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {toast && (
        <div className="absolute left-1/2 top-14 z-50 -translate-x-1/2 rounded-md border bg-card px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Opening notebook…
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr] lg:grid-cols-[300px_1fr_380px]">
          <aside className="hidden border-r md:block">
            <SourcesPanel
              notebookId={notebookId}
              sources={sources}
              busy={loading}
              onChanged={loadSources}
              onCompile={compile}
              compiling={compiling}
            />
          </aside>

          <main className="overflow-hidden border-r">
            <ReaderPanel
              notebookId={notebookId}
              pages={pages}
              busy={loading}
              openPath={openPath}
              onOpenPath={setOpenPath}
            />
          </main>

          <aside className="hidden overflow-hidden lg:block">
            <ChatPanel
              notebookId={notebookId}
              pages={pages}
              hasPages={pages.length > 0}
              onOpenPath={(p) => setOpenPath(p)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
