import { expect, test } from "vite-plus/test";
import { TOOL_DOCS } from "../src/tools.ts";
import path from "node:path";
import { readFileSync } from "node:fs";

/*
 * The published tool list (docs/guide/mcp.md) must name every tool in the catalogue, with its summary —
 * so the docs can't drift from the server (they both read `tools.ts`).
 */
const mcpDoc = readFileSync(path.join(import.meta.dirname, "../../../docs/guide/mcp.md"), "utf8");

test("every MCP tool is documented in mcp.md — name + summary, no drift", () => {
  for (const doc of TOOL_DOCS) {
    expect(mcpDoc, `tool "${doc.name}" name missing from mcp.md`).toContain(`\`${doc.name}\``);
    expect(mcpDoc, `tool "${doc.name}" summary missing from mcp.md`).toContain(doc.summary);
  }
});
