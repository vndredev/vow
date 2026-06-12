// @vitest-environment node
// oxlint-disable prefer-readonly-parameter-types -- the middleware bridges the mutable Node req/res objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Server, createServer } from "node:http";
import { expect, test } from "vite-plus/test";
import type { AddressInfo } from "node:net";
import { issuesApi } from "../src/dev-api.ts";
import { once } from "node:events";

const BAD_REQUEST = 400;

/** The bound loopback port from a listening server's address (the OS picks it via `listen(0)`). */
function portOf(address: AddressInfo | string | null): number {
  if (address !== null && typeof address !== "string") {
    return address.port;
  }
  return 0;
}

/** A throwaway loopback server running the real dev issue-write middleware, listening on an OS-picked port. */
async function listening(): Promise<Server> {
  const api = issuesApi(process.cwd());
  const server = createServer((req, res) => {
    api(req, res, () => {
      res.statusCode = BAD_REQUEST;
      res.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

test("a malformed issue-write body returns 400, not 500 (a client error, not a server crash)", async () => {
  const server = await listening();
  try {
    // `{}` is valid JSON but fails the issue-write shape — the distinct validation branch, never the catch.
    const response = await fetch(`http://127.0.0.1:${portOf(server.address())}`, {
      body: "{}",
      method: "POST",
    });
    const text = await response.text();
    expect(response.status).toBe(BAD_REQUEST);
    expect(text).toContain("expected");
  } finally {
    server.close();
    await once(server, "close");
  }
});
