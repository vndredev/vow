// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { findGuideDir, listDocs, readDoc, searchDocs } from "../src/docs.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Studio } from "../src/types.ts";
import { composeTools } from "../src/compose.ts";
import { isRecord } from "@vow/core";
import path from "node:path";

/*
 * The docs tools serve the SAME `docs/guide/*.md` the site renders. They read the filesystem only (never
 * the studio's DB), so they are driven here over a real `McpServer` with a shape-only studio whose only
 * live field is `appDir` — pointed at this repo's `apps/studio/app`, an ancestor of `docs/guide`, so the
 * upward walk resolves the real guide. The found / malformed / absent branch of every docs tool is pinned.
 */

const REPO = path.resolve(import.meta.dirname, "../../..");
const APP_DIR = path.join(REPO, "apps/studio/app");

function unused(): never {
  throw new Error("studio is shape-only for the docs tools");
}

/** A shape-only studio whose only live field is `appDir` — the docs tools never touch the rest. */
const DOCS_STUDIO: Studio = {
  addEntity: unused,
  addField: unused,
  addForm: unused,
  addRecord: unused,
  addView: unused,
  appDir: APP_DIR,
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

/** A type guard yielding `readonly unknown[]` — keeps element reads off the array safe. */
function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** The single text block's body of a tool-call result — narrowed from the SDK's content union. */
function bodyOf(result: unknown): string {
  if (isRecord(result) && isArray(result["content"])) {
    const [block] = result["content"];
    if (isRecord(block) && block["type"] === "text" && typeof block["text"] === "string") {
      return block["text"];
    }
  }
  throw new Error("expected a single text block");
}

/** Connect a fresh in-memory client to a server composed over the docs studio — its `call(name, args)`. */
async function connect(): Promise<
  (name: string, args: Readonly<Record<string, unknown>>) => Promise<string>
> {
  const server = new McpServer({ name: "vow-test", version: "0.0.0" });
  composeTools(server, DOCS_STUDIO);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "agent", version: "0.0.0" });
  await server.connect(serverSide);
  await client.connect(clientSide);
  return async (name, args) => bodyOf(await client.callTool({ arguments: args, name }));
}

test("findGuideDir walks up from the app dir to the repo's docs/guide", () => {
  const guide = findGuideDir(APP_DIR);
  expect(guide).toBe(path.join(REPO, "docs/guide"));
});

test("listDocs enumerates the guide pages the site renders, by slug", () => {
  const slugs = listDocs(APP_DIR).map((page) => page.slug);
  expect(slugs).toContain("mcp");
  expect(slugs).toContain("getting-started");
  // Nested pages keep their forward-slashed slug, exactly the site's route tail.
  expect(slugs).toContain("primitives/button");
  // Every page carries a non-empty title (its first `# heading`).
  expect(listDocs(APP_DIR).every((page) => page.title !== "")).toBe(true);
});

test("readDoc returns a known page's raw markdown by slug", () => {
  const page = readDoc(APP_DIR, "mcp");
  expect(page?.slug).toBe("mcp");
  expect(page?.markdown).toContain("# The MCP server");
  // The `.md` suffix is tolerated on the slug.
  expect(readDoc(APP_DIR, "mcp.md")?.slug).toBe("mcp");
});

test("readDoc returns absent for a malformed or absent slug — no throw", () => {
  expect(readDoc(APP_DIR, "ghost")).toBeUndefined();
  expect(readDoc(APP_DIR, "")).toBeUndefined();
  // A traversal attempt is contained to the guide dir.
  expect(readDoc(APP_DIR, "../../package")).toBeUndefined();
});

test("searchDocs ranks pages by a query with a short excerpt, empty on a blank query", () => {
  const hits = searchDocs(APP_DIR, "MCP server");
  expect(hits.map((hit) => hit.slug)).toContain("mcp");
  expect(hits.find((hit) => hit.slug === "mcp")?.excerpt).not.toBe("");
  expect(searchDocs(APP_DIR, "   ")).toEqual([]);
  expect(searchDocs(APP_DIR, "zzzznosuchtermzzzz")).toEqual([]);
});

test("read_docs returns the page json when found, a graceful miss otherwise", async () => {
  const call = await connect();
  const found = await call("read_docs", { slug: "mcp" });
  expect(found).toContain("# The MCP server");
  const miss = await call("read_docs", { slug: "ghost" });
  expect(miss).toBe('no doc "ghost" — list_docs enumerates the pages');
});

test("list_docs + search_docs return json arrays over the real guide", async () => {
  const call = await connect();
  const listed = await call("list_docs", {});
  expect(listed).toContain('"slug": "mcp"');
  const searched = await call("search_docs", { query: "studio" });
  expect(searched).toContain('"slug":');
});
