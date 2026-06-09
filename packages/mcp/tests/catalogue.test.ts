// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { TOOL_DOCS } from "../src/tools.ts";

// The catalogue (`tools.ts`) is the single source: the server descriptions come from it (`summaryOf`)
// and the docs list from it. A tool registered but absent from the catalogue would get an empty
// description silently — so pin server ⟷ catalogue here. The regex tolerates multi-line `server.tool(`.
test("every registered MCP tool is in the catalogue, and vice versa — no drift", () => {
  const serverSrc = readFileSync(
    fileURLToPath(new URL("../src/server.ts", import.meta.url)),
    "utf8",
  );
  const registered = [...serverSrc.matchAll(/server\.tool\(\s*"([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(registered).size).toBe(registered.length); // no tool registered twice
  expect([...registered].sort()).toEqual(TOOL_DOCS.map((t) => t.name).sort());
});
