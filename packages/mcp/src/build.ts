import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Studio } from "./types.ts";
import { composeTools } from "./compose.ts";

/**
 * Build the vow MCP server over a `studio` — the `McpServer` named "vow" with every tool composed. The
 * single factory both transports share: the stdio entry (`server.ts`, an editor session) and the HTTP hub
 * channel (`http.ts`, the always-on local server) call this, so the tool set can never drift between them.
 */
export function buildVowMcp(studio: Studio): McpServer {
  const server = new McpServer({ name: "vow", version: "0.0.0" });
  composeTools(server, studio);
  return server;
}
