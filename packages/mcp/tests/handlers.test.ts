// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { composeTools } from "../src/compose.ts";
import { isRecord } from "@vow/core";
import { openStudio } from "../src/studio.ts";
import path from "node:path";
import { tmpdir } from "node:os";

/*
 * The MCP boundary the LLM actually drives — the tool handlers — was untested: the catalogue test stubs
 * the studio so the handlers never fire. Here a real `McpServer` is composed over a real `openStudio()`
 * and driven through an in-memory client, exactly as an agent drives it: each `callTool` parses the input,
 * runs the studio call, and returns the json/text envelope. The found / not-found branch of every read +
 * data tool is asserted. The github tools shell out to `gh`, so they stay out of this hermetic suite.
 */

/** A live client wired to a freshly composed server — `call` returns a tool result's text body. */
interface Harness {
  readonly call: (name: string, args: Readonly<Record<string, unknown>>) => Promise<string>;
}

/** A type guard yielding `readonly unknown[]` (not `any[]`) — keeps element reads off the array safe. */
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

/** A string field off a JSON-encoded record body — `""` when absent or not a string. */
function fieldOf(body: string, key: string): string {
  const parsed: unknown = JSON.parse(body);
  if (isRecord(parsed) && typeof parsed[key] === "string") {
    return parsed[key];
  }
  return "";
}

/** An array field off a JSON-encoded record body — `[]` when absent or not an array. */
function arrayOf(body: string, key: string): readonly unknown[] {
  const parsed: unknown = JSON.parse(body);
  if (isRecord(parsed) && isArray(parsed[key])) {
    return parsed[key];
  }
  return [];
}

/** Connect a fresh in-memory client to a server composed over `studio` — its `call(name, args)`. */
async function connect(studio: ReturnType<typeof openStudio>): Promise<Harness> {
  const server = new McpServer({ name: "vow-test", version: "0.0.0" });
  composeTools(server, studio);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "agent", version: "0.0.0" });
  await server.connect(serverSide);
  await client.connect(clientSide);
  return { call: async (name, args) => bodyOf(await client.callTool({ arguments: args, name })) };
}

/** Build the harness over a temp app dir with a single `task` entity, run `body`, then clean up. */
async function withHarness(body: (harness: Harness) => Promise<void>): Promise<void> {
  const root = mkdtempSync(path.join(tmpdir(), "vow-mcp-handlers-"));
  const appDir = path.join(root, "app");
  try {
    const studio = openStudio(appDir);
    studio.createEntity({
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task",
      slug: "task",
    });
    await body(await connect(studio));
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

/** Add a task and return its minted id. */
async function addTask(call: Harness["call"], title: string): Promise<string> {
  return fieldOf(await call("add_record", { entity: "task", record: { title } }), "id");
}

test("get_vow returns the vow as json when found, a text miss otherwise", async () => {
  await withHarness(async ({ call }) => {
    expect(fieldOf(await call("get_vow", { slug: "task" }), "slug")).toBe("task");
    expect(await call("get_vow", { slug: "ghost" })).toBe('no vow "ghost"');
  });
});

test("get_record returns the row as json when found, a text miss otherwise", async () => {
  await withHarness(async ({ call }) => {
    const id = await addTask(call, "Ship it");
    expect(fieldOf(await call("get_record", { entity: "task", id }), "title")).toBe("Ship it");
    expect(await call("get_record", { entity: "task", id: "missing" })).toBe('no record "missing"');
  });
});

test("remove_record confirms a delete, reports a miss on the second call", async () => {
  await withHarness(async ({ call }) => {
    const id = await addTask(call, "Drop me");
    expect(await call("remove_record", { entity: "task", id })).toBe(`removed record "${id}"`);
    expect(await call("remove_record", { entity: "task", id })).toBe(`no record "${id}"`);
  });
});

test("set_record_field returns the patched row as json when found, a text miss otherwise", async () => {
  await withHarness(async ({ call }) => {
    const id = await addTask(call, "Old");
    const patched = await call("set_record_field", {
      entity: "task",
      field: "title",
      id,
      value: "New",
    });
    expect(fieldOf(patched, "title")).toBe("New");
    const miss = await call("set_record_field", {
      entity: "task",
      field: "title",
      id: "nope",
      value: "x",
    });
    expect(miss).toBe('no record "nope"');
  });
});

test("add_view rejects an unknown node type synchronously — the build error, not a false success", async () => {
  await withHarness(async ({ call }) => {
    const good = await call("add_view", {
      intent: "A page",
      slug: "home",
      view: [{ type: "hero", value: { title: "Hi" } }],
    });
    expect(good).toBe('added view "home"');
    const bad = await call("add_view", {
      intent: "A bad page",
      slug: "broken",
      view: [{ type: "nope", value: {} }],
    });
    expect(bad).toContain('unknown view component "nope"');
  });
});

test("add_view rejects a breakout filter key synchronously — the #305 name-injection defense", async () => {
  await withHarness(async ({ call }) => {
    // A hostile filter key would close the emitted `:filter="{ ... }"` literal and run on render.
    // The seam rejects it before the vow is written (defense-in-depth with the emitter, mirroring #283).
    const bad = await call("add_view", {
      intent: "A bad page",
      slug: "evil",
      view: [{ type: "list", value: { filter: { "a }; alert(1); ({": "x" }, of: "task" } }],
    });
    expect(bad).toContain("not a safe identifier");
  });
});

test("studio_info publishes the view-node vocabulary so the LLM sees the valid types", async () => {
  await withHarness(async ({ call }) => {
    const types = arrayOf(await call("studio_info", {}), "viewNodeTypes");
    expect(types).toContain("hero");
    expect(types).toContain("button");
    expect(types).not.toContain("nope");
  });
});
