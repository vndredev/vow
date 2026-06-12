// @vitest-environment node
import { MCP_PATH, mcpHttpServer, mcpRoute } from "../src/http.ts";
import { expect, test } from "vite-plus/test";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";

const METHOD_NOT_ALLOWED = 405;
const NOT_FOUND = 404;

test("mcpRoute: POST /mcp handles, GET/DELETE are 405, a non-/mcp path is 404 (#490)", () => {
  expect(mcpRoute("POST", MCP_PATH)).toBe("handle");
  expect(mcpRoute("POST", `${MCP_PATH}?session=1`)).toBe("handle");
  expect(mcpRoute("GET", MCP_PATH)).toBe("method-not-allowed");
  expect(mcpRoute("DELETE", MCP_PATH)).toBe("method-not-allowed");
  expect(mcpRoute("POST", "/other")).toBe("not-found");
});

/** The bound loopback port of a listening server (the OS picks it via `listen(0)`). */
function portOf(address: Readonly<AddressInfo> | string | null): number {
  if (address !== null && typeof address !== "string") {
    return address.port;
  }
  return 0;
}

/** GET `base + suffix` and return the HTTP status (kept off the await expression so no member is read off it). */
async function getStatus(base: string, suffix: string): Promise<number> {
  const res = await fetch(`${base}${suffix}`, { method: "GET" });
  return res.status;
}

test("mcpHttpServer boots + routes: GET /mcp -> 405, an unknown path -> 404 (#490 element 2)", async () => {
  const server = mcpHttpServer(mkdtempSync(path.join(os.tmpdir(), "vow-mcp-")), 0);
  await once(server, "listening");
  const base = `http://localhost:${portOf(server.address())}`;
  try {
    expect(await getStatus(base, MCP_PATH)).toBe(METHOD_NOT_ALLOWED);
    expect(await getStatus(base, "/other")).toBe(NOT_FOUND);
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
});
