import { ArrowLeft, FileStack, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type Page, type PageDetail } from "@/lib/api";

interface Props {
  notebookId: string;
  pages: Page[];
  busy: boolean;
  openPath: string | null;
  onOpenPath: (path: string | null) => void;
}

const KIND_COLORS: Record<string, string> = {
  source: "bg-blue-500/15 text-blue-400",
  concept: "bg-violet-500/15 text-violet-400",
  entity: "bg-emerald-500/15 text-emerald-400",
  output: "bg-amber-500/15 text-amber-400",
  insight: "bg-pink-500/15 text-pink-400",
  community_summary: "bg-cyan-500/15 text-cyan-400",
  graph_report: "bg-orange-500/15 text-orange-400",
  index: "bg-slate-500/15 text-slate-400",
};

export function ReaderPanel({ notebookId, pages, busy, openPath, onOpenPath }: Props) {
  const [filter, setFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [detail, setDetail] = useState<PageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const kinds = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of pages) set.set(p.kind, (set.get(p.kind) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [pages]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return pages.filter(
      (p) =>
        (!kindFilter || p.kind === kindFilter) &&
        (!q || p.title.toLowerCase().includes(q))
    );
  }, [pages, filter, kindFilter]);

  useEffect(() => {
    if (!openPath) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    api
      .readPage(notebookId, openPath)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setLoadingDetail(false));
    return () => {
      cancelled = true;
    };
  }, [notebookId, openPath]);

  if (openPath) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenPath(null)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <span className="truncate text-sm font-medium">{detail?.title ?? openPath}</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl px-8 py-6">
            {loadingDetail ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading page…
              </div>
            ) : detail ? (
              <article className="md-prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <WikiLink href={href} pages={pages} onOpenPath={onOpenPath}>
                        {children}
                      </WikiLink>
                    ),
                  }}
                >
                  {rewriteWikilinks(detail.content)}
                </ReactMarkdown>
              </article>
            ) : (
              <div className="text-muted-foreground">Page not found.</div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileStack className="h-4 w-4 text-primary" /> Wiki pages
          <Badge variant="muted">{pages.length}</Badge>
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Filter pages…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <KindChip label="all" active={!kindFilter} onClick={() => setKindFilter(null)} />
          {kinds.map(([k, n]) => (
            <KindChip
              key={k}
              label={`${k} ${n}`}
              active={kindFilter === k}
              onClick={() => setKindFilter(kindFilter === k ? null : k)}
            />
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {busy && pages.length === 0 ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : pages.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No pages yet. Add sources and click <b>Compile wiki</b>.
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenPath(p.path)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/50"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    KIND_COLORS[p.kind] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.kind.replace("_", " ")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function KindChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}

/** Convert Obsidian-style [[path|label]] into normal markdown links. */
function rewriteWikilinks(md: string): string {
  return md.replace(/\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
    const [target, label] = inner.split("|");
    const text = (label ?? target).trim();
    return `[${text}](wiki:${encodeURIComponent(target.trim())})`;
  });
}

function WikiLink({
  href,
  children,
  pages,
  onOpenPath,
}: {
  href?: string;
  children: React.ReactNode;
  pages: Page[];
  onOpenPath: (p: string) => void;
}) {
  if (href?.startsWith("wiki:")) {
    const target = decodeURIComponent(href.slice(5));
    const match = resolveWikiTarget(target, pages);
    return (
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          if (match) onOpenPath(match);
        }}
        className={match ? "" : "opacity-60"}
        title={match ? target : `Unresolved: ${target}`}
      >
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function resolveWikiTarget(target: string, pages: Page[]): string | null {
  const norm = target.replace(/^\.?\//, "").replace(/\.md$/, "");
  const exact = pages.find(
    (p) => p.path === target || p.path.replace(/\.md$/, "") === norm
  );
  if (exact) return exact.path;
  const slug = norm.split("/").pop() ?? norm;
  const bySlug = pages.find((p) => p.path.replace(/\.md$/, "").endsWith(`/${slug}`));
  return bySlug?.path ?? null;
}
