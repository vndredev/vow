import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { TOOL_DOCS } from "../src/tools.ts";

// The published tool list (docs/guide/mcp.md) must name every tool in the catalogue, with its summary —
// so the docs can't drift from the server (they both read `tools.ts`).
const mcpDoc = readFileSync(join(import.meta.dirname, "../../../docs/guide/mcp.md"), "utf8");

test("every MCP tool is documented in mcp.md — name + summary, no drift", () => {
  for (const t of TOOL_DOCS) {
    expect(mcpDoc, `tool "${t.name}" name missing from mcp.md`).toContain(`\`${t.name}\``);
    expect(mcpDoc, `tool "${t.name}" summary missing from mcp.md`).toContain(t.summary);
  }
});
