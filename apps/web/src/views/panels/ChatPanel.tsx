import { Loader2, MessagesSquare, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api, type Page } from "@/lib/api";

interface Msg {
  role: "user" | "assistant";
  text: string;
  citations?: string[];
  related?: string[];
}

interface Props {
  notebookId: string;
  pages: Page[];
  hasPages: boolean;
  onOpenPath: (path: string) => void;
}

const SUGGESTIONS = [
  "Summarize the key themes across all sources",
  "What are the main concepts and how do they connect?",
  "What questions do these sources leave open?",
];

export function ChatPanel({ notebookId, pages, hasPages, onOpenPath }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || sending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setSending(true);
    try {
      const ans = await api.chat(notebookId, question, sessionId);
      setSessionId(ans.sessionId || sessionId);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: ans.answer,
          citations: ans.citations.map(String),
          related: ans.relatedPageIds,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  function pathForPageId(id: string): string | null {
    return pages.find((p) => p.id === id || p.sourceIds.includes(id))?.path ?? null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessagesSquare className="h-4 w-4 text-primary" /> Chat
        </h2>
        <Badge variant="muted" className="ml-auto gap-1">
          <Sparkles className="h-3 w-3" /> grounded
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {messages.length === 0 && (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Ask anything about your sources. Answers are grounded in the compiled wiki with
                citations.
              </p>
              {hasPages &&
                SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
                  >
                    {s}
                  </button>
                ))}
              {!hasPages && (
                <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  Compile the wiki first to enable grounded answers.
                </p>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                    : "max-w-full rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm"
                }
              >
                {m.role === "assistant" ? (
                  <div className="md-prose text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                        {m.citations.map((cid) => {
                          const path = pathForPageId(cid);
                          return (
                            <button
                              key={cid}
                              disabled={!path}
                              onClick={() => path && onOpenPath(path)}
                              className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary transition-colors enabled:hover:bg-primary/25 disabled:opacity-60"
                            >
                              {cid}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            className="max-h-32 min-h-[44px] resize-none"
            placeholder="Ask a question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Button size="icon" onClick={() => send(input)} disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
