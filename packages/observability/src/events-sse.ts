/* oxlint-disable prefer-readonly-parameter-types -- the handler bridges the mutable Node req/res objects */
/* oxlint-disable consistent-type-specifier-style -- one node:http import; a separate type import trips no-duplicate-imports */
import { type Server, type ServerResponse, createServer } from "node:http";
import { type VowEvent, eventsPath, readEvents } from "./events.ts";
import { mkdirSync, watch } from "node:fs";
import path from "node:path";

/**
 * The PROVIDER-NEUTRAL event channel — the realtime-observability feed streamed over Server-Sent Events.
 * Any SSE client subscribes to one always-on endpoint and receives the backlog, then each new event as it
 * is recorded: the studio's browser (EventSource), a generic agent, an orchestrator (curl / a tail), the
 * Claude Code Channels adapter — all over the same standard wire, no per-provider core (#497). Reuses the
 * `events.ts` reader; the file (`.vow/events.jsonl`) stays the equally-neutral tailable form.
 */

/** The path the event channel answers on. */
export const EVENTS_PATH = "/events";

// HTTP statuses: the SSE stream, and a non-`/events` path.
const STREAM_OK = 200;
const NOT_FOUND = 404;

/** The SSE frame for one event — the provider-neutral wire form every client reads (`data: <json>`). Pure,
    so the frame shape is unit-testable. */
export function eventFrame(event: Readonly<VowEvent>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Stream the live feed to one subscriber: the backlog now, then each new event as the log grows, until the
    client disconnects. `sent` tracks how many events went out, so a re-read only emits the delta (and a
    watch firing on an unrelated `.vow/` change is a harmless idempotent re-check). */
function stream(cwd: string, res: ServerResponse): void {
  res.writeHead(STREAM_OK, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream",
  });
  let sent = 0;
  const flush = (): void => {
    const events = readEvents(cwd);
    for (const event of events.slice(sent)) {
      res.write(eventFrame(event));
    }
    sent = events.length;
  };
  flush();
  mkdirSync(path.join(cwd, ".vow"), { recursive: true });
  const watcher = watch(path.dirname(eventsPath(cwd)), () => {
    flush();
  });
  res.on("close", () => {
    watcher.close();
  });
}

/** Start the provider-neutral event channel on `port`, streaming the feed under `cwd`'s `.vow/`. Returns the
    `http.Server` so the caller owns its lifecycle (shutdown with the hub). */
export function eventsSseServer(cwd: string, port: number): Server {
  const server = createServer((req, res) => {
    if ((req.url ?? "").split("?")[0] === EVENTS_PATH && req.method === "GET") {
      stream(cwd, res);
      return;
    }
    res.writeHead(NOT_FOUND);
    res.end();
  });
  server.listen(port);
  return server;
}
