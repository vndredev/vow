// @vitest-environment node
// oxlint-disable prefer-readonly-parameter-types -- the middleware bridges the mutable Node req/res objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Server, createServer } from "node:http";
import { addItem, openPlan } from "@vow/plan";
import { expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { planApi } from "../src/dev-handlers.ts";

/**
 * The local-plan API on `/__vow/plan`: a GET serves `@vow/plan`'s `planSnapshot` (items + the ready-queue +
 * the blocked set) read from `<root>/.vow/plan.db`; a non-GET passes through. Drives the real middleware over
 * a loopback socket against a seeded throwaway plan DB.
 */

const OK = 200;
const NEXT = 418;
const PORT_NONE = 0;
const ISSUE = 7;

/** A dev middleware — the shape `planApi` returns; resolved here so the test imports no type. */
type Middleware = ReturnType<typeof planApi>;

/** The bound loopback port from a listening server's address (the OS picks it via `listen(0)`). */
function portOf(address: AddressInfo | string | null): number {
  if (address !== null && typeof address !== "string") {
    return address.port;
  }
  return PORT_NONE;
}

/** A throwaway loopback server running the real plan middleware — `next` answers 418 on pass-through. */
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

/** Close a loopback server and remove its throwaway workspace. */
async function teardown(server: Server, dir: string): Promise<void> {
  server.close();
  await once(server, "close");
  rmSync(dir, { force: true, recursive: true });
}

/** GET the loopback `server`. */
async function get(server: Server, method = "GET"): Promise<Response> {
  const response = await fetch(`http://127.0.0.1:${portOf(server.address())}`, { method });
  return response;
}

test("GET /plan serves the seeded local plan snapshot", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vow-plan-api-"));
  addItem(openPlan(dir), { issue: ISSUE, title: "seeded work" });
  const server = await listening(planApi(dir));
  try {
    const response = await get(server);
    expect(response.status).toBe(OK);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toMatchObject({ items: [{ issue: ISSUE, title: "seeded work" }] });
  } finally {
    await teardown(server, dir);
  }
});

test("a non-GET passes through to the next handler", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vow-plan-api-"));
  const server = await listening(planApi(dir));
  try {
    const response = await get(server, "POST");
    expect(response.status).toBe(NEXT);
  } finally {
    await teardown(server, dir);
  }
});
