// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Studio } from "../src/types.ts";
import { TOOL_DOCS } from "../src/tools.ts";
import { composeTools } from "../src/compose.ts";

/*
 * The catalogue (`tools.ts`) is the single source: the server descriptions come from it (`summaryOf`)
 * and the docs list from it. A tool registered but absent from the catalogue would get an empty
 * description silently — so pin server <-> catalogue here. `composeTools` runs the real registration
 * over a fresh server; handlers never fire at registration, so the studio's methods are never called.
 */
function unused(): never {
  throw new Error("studio is shape-only at registration");
}

const STUB_STUDIO: Studio = {
  addEntity: unused,
  addField: unused,
  addForm: unused,
  addRecord: unused,
  addView: unused,
  appDir: "",
  entitySlugs: unused,
  getRecord: unused,
  getVow: unused,
  listRecords: unused,
  listVows: unused,
  removeField: unused,
  removeRecord: unused,
  removeVow: unused,
  setField: unused,
  setForm: unused,
  setIntent: unused,
  setNav: unused,
  setRecordField: unused,
  setSeed: unused,
  setView: unused,
  syncDb: unused,
  viewSlugs: unused,
};

test("every registered MCP tool is in the catalogue, and vice versa — no drift", () => {
  const server = new McpServer({ name: "vow", version: "0.0.0" });
  const registered = composeTools(server, STUB_STUDIO);

  // No tool registered twice.
  expect(new Set(registered).size).toBe(registered.length);
  expect([...registered].toSorted()).toEqual(TOOL_DOCS.map((doc) => doc.name).toSorted());
});
