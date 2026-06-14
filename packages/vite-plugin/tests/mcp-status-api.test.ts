// @vitest-environment node
// oxlint-disable prefer-readonly-parameter-types -- the middleware bridges the mutable Node req/res objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Server, createServer } from "node:http";
import { expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { isRecord } from "@vow/core";
import { mcpStatusApi } from "../src/mcp-status-handler.ts";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { recordEvent } from "@vow/observability";

/**
 * The MCP/channel-health API on `/__vow/mcp/status`: a GET serves the live health derived from the event
 * feed — `connected` from freshness (a recent event within 5 min), `toolCount` from the MCP catalogue,
 * and `lastEvent` from the newest feed entry (absent when the feed is empty). These drive the real
 * middleware over a loopback socket.
 */

const OK = 200;
const NEXT = 418;
const PORT_NONE = 0;

/** A dev middleware — the shape `mcpStatusApi` returns; resolved here so the test imports no type. */
type Middleware = ReturnType<typeof mcpStatusApi>;

/** The bound loopback port from a listening server's address (the OS picks it via `listen(0)`). */
function portOf(address: AddressInfo | string | null): number {
  if (address !== null && typeof address !== "string") {
    return address.port;
  }
  return PORT_NONE;
}

/** A throwaway loopback server running the real MCP-status middleware — `next` answers 418 on pass-through. */
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

/** A throwaway `.vow/`-able workspace dir (the API reads `.vow/events.jsonl` from it). */
function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "vow-mcp-api-"));
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

/** Assert the lastEvent on a narrowed body has a matching kind and a string ts. */
function assertLastEvent(body: Record<string, unknown>): void {
  const le = body["lastEvent"];
  expect(le).toMatchObject({ kind: "run.started" });
  if (!isRecord(le)) {
    throw new Error("expected lastEvent to be an object");
  }
  expect(typeof le["ts"]).toBe("string");
}

test("GET /mcp/status is disconnected + empty lastEvent when no events have been recorded", async () => {
  const dir = tempDir();
  const server = await listening(mcpStatusApi(dir));
  try {
    const response = await request(server);
    expect(response.status).toBe(OK);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toMatchObject({ connected: false });
    expect(body).not.toHaveProperty("lastEvent");
  } finally {
    await teardown(server, dir);
  }
});

test("GET /mcp/status carries lastEvent once the feed has an entry", async () => {
  const dir = tempDir();
  recordEvent(dir, "run.started");
  const server = await listening(mcpStatusApi(dir));
  try {
    const res = await request(server);
    const body: unknown = await res.json();
    if (!isRecord(body)) {
      throw new Error("expected response body to be an object");
    }
    assertLastEvent(body);
  } finally {
    await teardown(server, dir);
  }
});

test("GET /mcp/status carries a non-negative toolCount from the MCP catalogue", async () => {
  const dir = tempDir();
  const server = await listening(mcpStatusApi(dir));
  try {
    const response = await request(server);
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error("expected response body to be an object");
    }
    expect(typeof body["toolCount"]).toBe("number");
    expect(body["toolCount"]).toBeGreaterThanOrEqual(0);
  } finally {
    await teardown(server, dir);
  }
});

test("a non-GET passes through to next() — the MCP status surface is read-only", async () => {
  const dir = tempDir();
  const server = await listening(mcpStatusApi(dir));
  try {
    const response = await request(server, "POST");
    expect(response.status).toBe(NEXT);
  } finally {
    await teardown(server, dir);
  }
});
