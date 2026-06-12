#!/usr/bin/env -S node --experimental-strip-types
import { openStudio, resolveAppDir } from "./studio.ts";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildVowMcp } from "./build.ts";
import { defined } from "@vow/core";
import process from "node:process";

/**
 * The vow MCP server — the agent operates the studio over stdio. It composes the two write sides:
 * structure (the vows) via `@vow/core`'s mutations + serialize, and data (records) via `@vow/db`'s CRUD
 * over the shared local SQLite file. A structure write lands in `app/*.vow.md` -> a running `vp dev`
 * regenerates; a data write lands in `.vow/data.db` -> the studio refetches. The same tools run against
 * D1 on typed.build in prod. Each tool's description is `summaryOf(name)` from the single-source
 * `tools.ts` catalogue (which the docs list from). Launch via the `start` script or the project
 * `.mcp.json` (see docs/guide/mcp.md). The tool set is grouped read / structure / data / github — one
 * register module each, assembled by `composeTools`.
 */

const appDir = resolveAppDir();
if (!defined(appDir)) {
  process.stderr.write("vow MCP: set VOW_APP_DIR (or pass the app dir as the first argument)\n");
  process.exit(1);
}

const server = buildVowMcp(openStudio(appDir));

await server.connect(new StdioServerTransport());
