import { Brain, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { navigate } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, type Notebook } from "@/lib/api";

export function HomeView() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setNotebooks(await api.listNotebooks());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const nb = await api.createNotebook(newName || "Untitled notebook");
      setDialogOpen(false);
      setNewName("");
      navigate(`/n/${nb.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string, ev: React.MouseEvent) {
    ev.stopPropagation();
    if (!confirm("Delete this notebook and all its sources?")) return;
    await api.deleteNotebook(id);
    refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">nbllmvault</h1>
            <p className="text-sm text-muted-foreground">
              Import anything · compile a linked wiki · ask grounded questions
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New notebook
        </Button>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notebooks…
        </div>
      ) : notebooks.length === 0 ? (
        <EmptyState onCreate={() => setDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.map((nb) => (
            <Card
              key={nb.id}
              onClick={() => navigate(`/n/${nb.id}`)}
              className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div className="text-3xl">{nb.emoji}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => remove(nb.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="mb-1 line-clamp-2 font-semibold">{nb.name}</h3>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {nb.compiledAt
                    ? `Compiled ${timeAgo(nb.compiledAt)}`
                    : "Not compiled yet"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New notebook</DialogTitle>
            <DialogDescription>
              Each notebook is its own knowledge vault: sources, a compiled wiki, and grounded chat.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="e.g. Quantum computing research"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed py-20 text-center">
      <Brain className="mb-4 h-12 w-12 text-muted-foreground/50" />
      <h2 className="mb-1 text-lg font-semibold">No notebooks yet</h2>
      <p className="mb-5 max-w-sm text-sm text-muted-foreground">
        Create your first notebook, drop in PDFs, URLs, notes, or transcripts, and compile a
        connected knowledge base you can question.
      </p>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" /> Create notebook
      </Button>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
