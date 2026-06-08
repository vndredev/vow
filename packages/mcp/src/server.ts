import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  addEntity,
  addField,
  addView,
  Field,
  loadVows,
  removeField,
  removeVow,
  setIntent,
  setNav,
  ViewNode,
  type Vow,
} from "@vow/core";
import {
  bootstrap,
  get,
  insert,
  list,
  migrate,
  openDb,
  remove,
  resolveDbPath,
  update,
} from "@vow/db";
import { z } from "zod";

/**
 * vow's MCP server — the agent operates the studio over stdio. It composes the two write sides directly:
 * **structure** (the vows) via `@vow/core`'s mutations + `serialize`, and **data** (records) via
 * `@vow/db`'s CRUD over the shared local SQLite file. A structure write lands in `app/*.vow.md` → a
 * running `vp dev` regenerates; a data write lands in `.vow/data.db` → the studio refetches. The same
 * tools run against D1 on typed.build in prod. Launch: `VOW_APP_DIR=apps/studio/app pnpm --filter @vow/mcp start`.
 */

const raw = process.env["VOW_APP_DIR"] ?? process.argv[2];
if (raw === undefined || raw === "") {
  process.stderr.write("vow MCP: set VOW_APP_DIR (or pass the app dir as the first argument)\n");
  process.exit(1);
}
const appDir = resolve(raw);
const db = openDb(resolveDbPath(dirname(appDir))); // the same file the dev server / D1 serves

const isEntity = (v: Vow): boolean => v.fulfills?.kind === "emit" && v.fulfills.as === "entity";
const entities = (): Vow[] => loadVows(appDir).filter(isEntity);
const syncDb = (): void => {
  const es = entities();
  migrate(db, es);
  bootstrap(db, es);
};
const entityOf = (slug: string): Vow => {
  const e = entities().find((v) => v.slug === slug);
  if (!e) throw new Error(`no entity "${slug}"`);
  return e;
};
syncDb();

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const json = (data: unknown) => text(JSON.stringify(data, null, 2));

const server = new McpServer({ name: "vow", version: "0.0.0" });

// — read —
server.tool("list_vows", "List every vow (slug · kind · intent).", {}, () =>
  json(loadVows(appDir).map((v) => ({ slug: v.slug, fulfills: v.fulfills, intent: v.intent }))),
);
server.tool("get_vow", "Get one vow by slug.", { slug: z.string() }, ({ slug }) => {
  const v = loadVows(appDir).find((x) => x.slug === slug);
  return v ? json(v) : text(`no vow "${slug}"`);
});

// — structure (the vows) —
server.tool(
  "add_entity",
  "Add a new entity (a data model) to the studio.",
  { slug: z.string(), intent: z.string(), fields: z.array(Field).optional() },
  ({ slug, intent, fields }) => {
    const v = addEntity(appDir, { slug, intent, fields });
    syncDb();
    return text(`added entity "${v.slug}"`);
  },
);
server.tool(
  "add_field",
  "Add a field to an entity.",
  { entity: z.string(), field: Field },
  ({ entity, field }) => {
    addField(appDir, entity, field);
    syncDb();
    return text(`added field "${field.name}" to "${entity}"`);
  },
);
server.tool(
  "remove_field",
  "Remove a field from an entity by name.",
  { entity: z.string(), field: z.string() },
  ({ entity, field }) => {
    removeField(appDir, entity, field);
    return text(`removed field "${field}" from "${entity}"`);
  },
);
server.tool(
  "add_view",
  "Add a view (a page). `view` is a list of { type, value } nodes (e.g. { type: list, value: task }).",
  {
    slug: z.string(),
    intent: z.string(),
    view: z.array(ViewNode),
    nav: z.record(z.string(), z.unknown()).optional(),
  },
  ({ slug, intent, view, nav }) => {
    const v = addView(appDir, { slug, intent, view, nav: nav as Vow["nav"] });
    return text(`added view "${v.slug}"`);
  },
);
server.tool(
  "set_intent",
  "Set a vow's intent.",
  { slug: z.string(), intent: z.string() },
  ({ slug, intent }) => {
    setIntent(appDir, slug, intent);
    return text(`set intent of "${slug}"`);
  },
);
server.tool(
  "set_nav",
  "Set a vow's nav entry (label · icon · order · group).",
  { slug: z.string(), nav: z.record(z.string(), z.unknown()) },
  ({ slug, nav }) => {
    setNav(appDir, slug, nav as Vow["nav"]);
    return text(`set nav of "${slug}"`);
  },
);
server.tool("remove_vow", "Delete a vow (its .md).", { slug: z.string() }, ({ slug }) => {
  removeVow(appDir, slug);
  return text(`removed vow "${slug}"`);
});

// — data (the records) —
server.tool("list_records", "List an entity's records.", { entity: z.string() }, ({ entity }) =>
  json(list(db, entityOf(entity))),
);
server.tool(
  "get_record",
  "Get one record by id.",
  { entity: z.string(), id: z.string() },
  ({ entity, id }) => {
    const r = get(db, entityOf(entity), id);
    return r ? json(r) : text(`no record "${id}"`);
  },
);
server.tool(
  "add_record",
  "Add a record to an entity (an id is minted; absent fields get defaults).",
  { entity: z.string(), record: z.record(z.string(), z.unknown()) },
  ({ entity, record }) => json(insert(db, entityOf(entity), record)),
);
server.tool(
  "set_record_field",
  "Patch one field of a record (e.g. move a task by setting its status).",
  { entity: z.string(), id: z.string(), field: z.string(), value: z.unknown() },
  ({ entity, id, field, value }) => {
    const r = update(db, entityOf(entity), id, { [field]: value });
    return r ? json(r) : text(`no record "${id}"`);
  },
);
server.tool(
  "remove_record",
  "Delete a record by id.",
  { entity: z.string(), id: z.string() },
  ({ entity, id }) =>
    text(remove(db, entityOf(entity), id) ? `removed record "${id}"` : `no record "${id}"`),
);

await server.connect(new StdioServerTransport());
