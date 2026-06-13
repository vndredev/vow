// @vitest-environment node
// oxlint-disable prefer-readonly-parameter-types -- the middleware bridges the mutable Node req/res objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Server, createServer } from "node:http";
import { expect, test } from "vite-plus/test";
import { loopStatusApi, repoRootOf } from "../src/dev-api.ts";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { writeLoopStatus } from "@vow/observability";

/**
 * The loop-status API on `/__vow/agent-loop/status`: a GET serves the agent loop's live status read from
 * `cwd`'s `.vow/loop-status.json` (what the loop process records) — the seam that makes the autonomous loop
 * observable. An absent file is the `running: false` idle default. These drive the real middleware over a
 * loopback socket and pin the repo-root resolution the mount uses.
 */

const OK = 200;
const NEXT = 418;
const ROUND = 4;
const BACKLOG = 7;

/** A dev middleware — the shape `loopStatusApi` returns; resolved here so the test imports no type. */
type Middleware = ReturnType<typeof loopStatusApi>;

/** The bound loopback port from a listening server's address (the OS picks it via `listen(0)`). */
function portOf(address: AddressInfo | string | null): number {
  if (address !== null && typeof address !== "string") {
    return address.port;
  }
  return 0;
}

/** A throwaway loopback server running the real loop-status middleware — the `next` fallback is a 418 so a
 *  request the middleware passes through (a non-GET) is observable, not a hang. */
async function listening(api: Middleware): Promise<Server> {
  const server = createServer((req, res) => {
    api(req, res, () => {
      res.statusCode = NEXT;
      res.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

/** A throwaway `.vow/`-able workspace dir. */
function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "vow-loop-api-"));
}

/** Close a loopback server and remove its throwaway workspace. */
async function teardown(server: Server, dir: string): Promise<void> {
  server.close();
  await once(server, "close");
  rmSync(dir, { force: true, recursive: true });
}

/** GET the loopback `server`, optionally with a method override. */
async function request(server: Server, method = "GET"): Promise<Response> {
  const url = `http://127.0.0.1:${portOf(server.address())}`;
  const response = await fetch(url, { method });
  return response;
}

test("GET /agent-loop/status returns the written loop status — the loop made observable", async () => {
  const dir = tempDir();
  writeLoopStatus(dir, {
    backlog: BACKLOG,
    lastRound: "2026-06-13T12:00:00.000Z",
    openPrs: 0,
    round: ROUND,
    running: true,
  });
  const server = await listening(loopStatusApi(dir));
  try {
    const response = await request(server);
    expect(response.status).toBe(OK);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toMatchObject({ backlog: BACKLOG, round: ROUND, running: true });
  } finally {
    await teardown(server, dir);
  }
});

test("GET /agent-loop/status is the idle default when no loop has run — the file is absent", async () => {
  const dir = tempDir();
  const server = await listening(loopStatusApi(dir));
  try {
    const response = await request(server);
    const body: unknown = await response.json();
    expect(body).toEqual({ backlog: 0, openPrs: 0, round: 0, running: false });
  } finally {
    await teardown(server, dir);
  }
});

test("a non-GET passes through to next() — the status surface is read-only", async () => {
  const dir = tempDir();
  const server = await listening(loopStatusApi(dir));
  try {
    const response = await request(server, "POST");
    expect(response.status).toBe(NEXT);
  } finally {
    await teardown(server, dir);
  }
});

test("repoRootOf walks up from an app cwd to the workspace root, NONE when none is above", () => {
  // The dev server's cwd is the Vite app root (apps/<slug>); the walk up finds the workspace root above it.
  // The loop-status mount reads that REPO-ROOT `.vow/` the loop records, not the app-local one.
  const appCwd = path.join(process.cwd(), "apps", "studio");
  const root = repoRootOf(appCwd);
  expect(typeof root === "string" && appCwd.startsWith(root)).toBe(true);
  expect(root === path.join(appCwd, "apps", "studio")).toBe(false);
  // The filesystem root has no `pnpm-workspace.yaml` above it — NONE.
  expect(repoRootOf(path.parse(process.cwd()).root)).toBeUndefined();
});
