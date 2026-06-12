/* oxlint-disable prefer-readonly-parameter-types -- the handler bridges the mutable Node req/res objects */
/* oxlint-disable consistent-type-specifier-style -- one node:http import; a separate type import trips no-duplicate-imports */
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Studio } from "./types.ts";
import { buildVowMcp } from "./build.ts";
import { openStudio } from "./studio.ts";
import process from "node:process";

/**
 * The persistent MCP channel over HTTP — the always-on local hub endpoint many agents/clients POST to,
 * replacing the stdio-per-editor-session launch. Stateless: omitting `sessionIdGenerator` makes each request
 * one self-contained exchange (no SSE session), a fresh server + transport per request torn down after it,
 * the studio (the SQLite-backed data layer) shared across requests. `enableJsonResponse` keeps a plain
 * request/response shape for tool calls. Mounted on `vow serve` (#490 element 2).
 */

/** The path the MCP endpoint answers on the hub. */
export const MCP_PATH = "/mcp";

// HTTP statuses: a non-`/mcp` path, a non-POST method, and a handler that threw.
const NOT_FOUND = 404;
const NOT_ALLOWED = 405;
const INTERNAL_ERROR = 500;

/** Decide how to handle an HTTP request to the MCP channel by method + path. The stateless transport only
    accepts POST (one request = one exchange), so GET/DELETE are 405 and a non-`/mcp` path is 404. Pure, so
    the routing is unit-testable without a live server. */
export function mcpRoute(
  method: string,
  url: string,
): "handle" | "method-not-allowed" | "not-found" {
  const path = url.split("?")[0] ?? "";
  if (path !== MCP_PATH) {
    return "not-found";
  }
  if (method !== "POST") {
    return "method-not-allowed";
  }
  return "handle";
}

/** Ignore a promise that handles its own errors — keeps the request listener sync without a floating
    promise (`handle` catches everything + replies, so nothing is left to await). */
function ignore(promise: Promise<void>): boolean {
  return promise instanceof Promise;
}

/** Reply with a status and no body (the routed-away 404 / 405, or a 500 after a handler throw). */
function reply(res: ServerResponse, status: number): void {
  res.writeHead(status);
  res.end();
}

/** Handle one MCP request statelessly — a fresh server + transport, connected, run, then torn down; the
    shared `studio` carries the state. Catches everything (writes a 500 if nothing was sent), so the request
    listener that fires it stays sync + floating-promise-free. */
async function handle(studio: Studio, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const server = buildVowMcp(studio);
  const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
  try {
    // @ts-expect-error -- SDK type quirk: Transport.onmessage is generic vs this transport's concrete one under strictFunctionTypes; it implements Transport at runtime.
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    process.stderr.write(`vow mcp: request failed: ${String(error)}\n`);
    if (!res.headersSent) {
      reply(res, INTERNAL_ERROR);
    }
  } finally {
    await transport.close();
    await server.close();
  }
}

/** Start the persistent MCP channel over HTTP on `port`, reading/writing the studio at `appDir`. One
    always-on server many clients POST to (the local hub). Returns the `http.Server` so the caller owns its
    lifecycle (shutdown with the hub). */
export function mcpHttpServer(appDir: string, port: number): Server {
  const studio = openStudio(appDir);
  const server = createServer((req, res) => {
    const route = mcpRoute(req.method ?? "", req.url ?? "");
    if (route === "handle") {
      ignore(handle(studio, req, res));
      return;
    }
    if (route === "method-not-allowed") {
      reply(res, NOT_ALLOWED);
      return;
    }
    reply(res, NOT_FOUND);
  });
  server.listen(port);
  return server;
}
