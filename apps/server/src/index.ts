import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { PORT } from "./config.js";
import { api } from "./routes.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/healthz", (c) => c.json({ ok: true, service: "nbllmvault", ts: new Date().toISOString() }));

app.route("/api", api);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`🧠 nbllmvault server listening on http://localhost:${info.port}`);
  console.log(`   API base: http://localhost:${info.port}/api`);
});
