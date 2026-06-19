import {
  FileText,
  Globe,
  Hammer,
  Link2,
  Loader2,
  Plus,
  StickyNote,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type Source } from "@/lib/api";

interface Props {
  notebookId: string;
  sources: Source[];
  busy: boolean;
  onChanged: () => void;
  onCompile: () => void;
  compiling: boolean;
}

export function SourcesPanel({
  notebookId,
  sources,
  busy,
  onChanged,
  onCompile,
  compiling,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(fn: () => Promise<unknown>) {
    setWorking(true);
    setError(null);
    try {
      await fn();
      onChanged();
      setAddOpen(false);
      setUrl("");
      setNoteTitle("");
      setNoteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setWorking(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        await api.importFile(notebookId, f);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" /> Sources
          <Badge variant="muted">{sources.length}</Badge>
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {busy && sources.length === 0 ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : sources.length === 0 ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Upload className="h-6 w-6" />
              Drop files, add URLs, or paste notes to get started.
            </button>
          ) : (
            sources.map((s) => <SourceRow key={s.sourceId} source={s} />)
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <Button className="w-full" onClick={onCompile} disabled={compiling || sources.length === 0}>
          {compiling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
          {compiling ? "Compiling…" : "Compile wiki"}
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a source</DialogTitle>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Tabs defaultValue="file">
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                <Upload className="h-4 w-4" /> File
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1">
                <Link2 className="h-4 w-4" /> URL
              </TabsTrigger>
              <TabsTrigger value="note" className="flex-1">
                <StickyNote className="h-4 w-4" /> Paste
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="pt-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Upload className="h-7 w-7" />
                Click to choose files
                <span className="text-xs">PDF · DOCX · MD · CSV · EPUB · audio · code · 30+ formats</span>
              </button>
            </TabsContent>

            <TabsContent value="url" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Paste any URL — articles, arXiv papers, DOIs, tweets, YouTube — captured with smart
                extraction.
              </p>
              <Input
                placeholder="https://arxiv.org/abs/2401.12345"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <DialogFooter>
                <Button
                  disabled={!url.trim() || working}
                  onClick={() => run(() => api.importUrl(notebookId, url.trim()))}
                >
                  {working && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Globe className="h-4 w-4" /> Import URL
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="note" className="space-y-3 pt-4">
              <Input
                placeholder="Note title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
              <Textarea
                placeholder="Paste or type any text…"
                className="min-h-[160px]"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <DialogFooter>
                <Button
                  disabled={!noteText.trim() || working}
                  onClick={() => run(() => api.importText(notebookId, noteTitle, noteText))}
                >
                  {working && <Loader2 className="h-4 w-4 animate-spin" />} Add note
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourceRow({ source }: { source: Source }) {
  const Icon = source.url ? Globe : source.sourceKind === "markdown" ? StickyNote : FileText;
  return (
    <div className="flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-accent/50">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium" title={source.title}>
          {source.title}
        </div>
        <div className="text-xs text-muted-foreground">{source.sourceKind}</div>
      </div>
    </div>
  );
}
