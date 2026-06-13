// @vitest-environment node
// oxlint-disable prefer-readonly-parameter-types -- the middleware bridges the mutable Node req/res objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Server, createServer } from "node:http";
import { eventsApi, repoRootOf, wantsEventStream } from "../src/dev-api.ts";
import { expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import path from "node:path";
import { recordEvent } from "@vow/observability";
import { tmpdir } from "node:os";

/**
 * The events API content-negotiates on `/__vow/events`: a plain GET is the JSON snapshot (the store's 5s
 * poll fallback); a browser `EventSource` (its `Accept: text/event-stream`) gets the live SSE stream — the
 * backlog, then each new event PUSHED the instant it is recorded, so the studio trace is true realtime
 * under `vow dev`, not only under `vow serve`. These tests drive the real middleware over a loopback socket.
 */

const OK = 200;
const PORT_NONE = 0;

/** A dev middleware — the shape `eventsApi` returns; resolved here so the test imports no type. */
type Middleware = ReturnType<typeof eventsApi>;

/** A body reader for an SSE response — narrowed off the optional `response.body` so no `!` is needed. */
type Reader = ReadableStreamDefaultReader<Uint8Array>;

/** The bound loopback port from a listening server's address (the OS picks it via `listen(0)`). */
function portOf(address: AddressInfo | string | null): number {
  if (address !== null && typeof address !== "string") {
    return address.port;
  }
  return PORT_NONE;
}

/** A throwaway loopback server running the real events middleware on an OS-picked port. */
async function listening(api: Middleware): Promise<Server> {
  const server = createServer((req, res) => {
    api(req, res, () => {
      res.statusCode = OK;
      res.end();
    });
  });
  server.listen(PORT_NONE, "127.0.0.1");
  await once(server, "listening");
  return server;
}

/** A throwaway `.vow/` workspace with one recorded event — the feed the middleware reads from. */
function seededDir(kind: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "vow-events-"));
  recordEvent(dir, kind);
  return dir;
}

/** A throwaway workspace root (holds `pnpm-workspace.yaml`) with an `apps/<slug>` app dir below it — the
 *  shape `repoRootOf` walks up across. Returns the root and the nested app dir the dev server runs from. */
function workspaceWithApp(): { root: string; app: string } {
  const root = mkdtempSync(path.join(tmpdir(), "vow-events-root-"));
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n");
  const app = path.join(root, "apps", "studio");
  mkdirSync(app, { recursive: true });
  return { app, root };
}

/** Close a loopback server and remove its throwaway workspace — the one teardown both tests share. */
async function teardown(server: Server, dir: string): Promise<void> {
  server.close();
  await once(server, "close");
  rmSync(dir, { force: true, recursive: true });
}

/** GET the loopback `server`, optionally as an SSE client (`Accept: text/event-stream`). */
async function get(server: Server, accept: string): Promise<Response> {
  const url = `http://127.0.0.1:${portOf(server.address())}`;
  const response = await fetch(url, { headers: { accept } });
  return response;
}

/** The body reader of an SSE response — throwing (not asserting `!`) when the body is absent. */
function readerOf(response: Readonly<Response>): Reader {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("the SSE response had no readable body");
  }
  return reader;
}

/** Read the next chunk of an SSE response body as text — the next frame the stream emits. */
async function nextFrame(reader: Readonly<Reader>): Promise<string> {
  const chunk = await reader.read();
  return new TextDecoder().decode(chunk.value);
}

/** Assert the realtime push: the connect backlog frame arrives, then a freshly recorded event is PUSHED
 *  as its own frame — no poll involved. Kept off the test body so the test stays under the statement cap. */
async function assertRealtimePush(reader: Readonly<Reader>, dir: string): Promise<void> {
  // The connect-time backlog frame (the run.started seed) arrives first.
  expect(await nextFrame(reader)).toContain("run.started");
  // Record a NEW event — the watch fires and the stream pushes its frame, no poll involved.
  recordEvent(dir, "pr.merged");
  expect(await nextFrame(reader)).toContain("pr.merged");
  await reader.cancel();
}

test("wantsEventStream is true only for an Accept asking for the SSE wire (a browser EventSource)", () => {
  // A browser `EventSource` always sends `Accept: text/event-stream`; a plain poll (or no header) does not.
  // An absent header reads as `""` off a header-less record — the same absent case `req.headers.accept` hits.
  const headers: Record<string, string> = {};
  expect(wantsEventStream("text/event-stream")).toBe(true);
  expect(wantsEventStream("text/html, */*")).toBe(false);
  expect(wantsEventStream(headers["accept"])).toBe(false);
});

test("a plain GET gets the JSON snapshot — the store's poll fallback when SSE is unavailable", async () => {
  const dir = seededDir("run.started");
  const server = await listening(eventsApi(dir));
  try {
    const response = await get(server, "application/json");
    expect(response.status).toBe(OK);
    expect(response.headers.get("content-type")).toContain("application/json");
    const feed: unknown = await response.json();
    expect(Array.isArray(feed) && feed.length === 1).toBe(true);
  } finally {
    await teardown(server, dir);
  }
});

test("an EventSource GET streams the live feed — a freshly recorded event PUSHES instantly (realtime)", async () => {
  // The studio's `EventSource` gets the SSE stream — the backlog, then each new event the instant it lands.
  // The helper reads the backlog frame, records a fresh event, then reads the frame the stream pushes for it.
  const dir = seededDir("run.started");
  const server = await listening(eventsApi(dir));
  const response = await get(server, "text/event-stream");
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  try {
    await assertRealtimePush(readerOf(response), dir);
  } finally {
    await teardown(server, dir);
  }
});

test("the events feed resolves the REPO ROOT — the trace reads where the loop records, not app-local (#620)", async () => {
  // The dev server's cwd is `apps/studio`, but `vow agent auto` records to the REPO-ROOT `.vow/events.jsonl`.
  // The mount resolves the root via `repoRootOf`, so the feed reads the loop's log, not the empty app-local
  // `.vow/`. Record at the root, serve the feed from the resolved root, assert the GET snapshot has the event.
  const { app, root } = workspaceWithApp();
  recordEvent(root, "pr.merged");
  const resolved = repoRootOf(app);
  expect(resolved).toBe(root);
  const server = await listening(eventsApi(resolved ?? app));
  try {
    const response = await get(server, "application/json");
    const feed: unknown = await response.json();
    expect(Array.isArray(feed) && feed.length === 1).toBe(true);
  } finally {
    await teardown(server, root);
  }
});
