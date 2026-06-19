import { useEffect, useState } from "react";
import { HomeView } from "./views/HomeView";
import { NotebookView } from "./views/NotebookView";

/**
 * Minimal hash-based routing:
 *   #/                 -> notebook grid (home)
 *   #/n/<notebookId>   -> single notebook workspace
 */
function parseHash(): { view: "home" | "notebook"; id?: string } {
  const hash = window.location.hash.replace(/^#/, "");
  const m = hash.match(/^\/n\/([^/]+)/);
  if (m) return { view: "notebook", id: m[1] };
  return { view: "home" };
}

export function App() {
  const [route, setRoute] = useState(parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route.view === "notebook" && route.id) {
    return <NotebookView notebookId={route.id} />;
  }
  return <HomeView />;
}

export function navigate(to: string) {
  window.location.hash = to;
}
