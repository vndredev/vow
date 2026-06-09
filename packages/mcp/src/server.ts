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
import {
  addToProject,
  assignIssue,
  closeIssue,
  createIssue,
  featureIssueBody,
  gitRemoteUrl,
  issuePlan,
  syncProjectStatus,
} from "@vow/observability";
import { z } from "zod";
import { summaryOf } from "./tools.ts";

/**
 * vow's MCP server — the agent operates the studio over stdio. It composes the two write sides directly:
 * **structure** (the vows) via `@vow/core`'s mutations + `serialize`, and **data** (records) via
 * `@vow/db`'s CRUD over the shared local SQLite file. A structure write lands in `app/*.vow.md` → a
 * running `vp dev` regenerates; a data write lands in `.vow/data.db` → the studio refetches. The same
 * tools run against D1 on typed.build in prod. Each tool's description is `summaryOf(name)` from the
 * single-source `tools.ts` catalogue (which the docs list from). Launch via the `start` script or the
 * project `.mcp.json` (see docs/guide/mcp.md).
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
server.tool("list_vows", summaryOf("list_vows"), {}, () =>
  json(loadVows(appDir).map((v) => ({ slug: v.slug, fulfills: v.fulfills, intent: v.intent }))),
);
server.tool("get_vow", summaryOf("get_vow"), { slug: z.string() }, ({ slug }) => {
  const v = loadVows(appDir).find((x) => x.slug === slug);
  return v ? json(v) : text(`no vow "${slug}"`);
});

// — structure (the vows) —
server.tool(
  "add_entity",
  summaryOf("add_entity"),
  { slug: z.string(), intent: z.string(), fields: z.array(Field).optional() },
  ({ slug, intent, fields }) => {
    const v = addEntity(appDir, { slug, intent, fields });
    syncDb();
    return text(`added entity "${v.slug}"`);
  },
);
server.tool(
  "add_field",
  summaryOf("add_field"),
  { entity: z.string(), field: Field },
  ({ entity, field }) => {
    addField(appDir, entity, field);
    syncDb();
    return text(`added field "${field.name}" to "${entity}"`);
  },
);
server.tool(
  "remove_field",
  summaryOf("remove_field"),
  { entity: z.string(), field: z.string() },
  ({ entity, field }) => {
    removeField(appDir, entity, field);
    return text(`removed field "${field}" from "${entity}"`);
  },
);
server.tool(
  "add_view",
  summaryOf("add_view"),
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
  summaryOf("set_intent"),
  { slug: z.string(), intent: z.string() },
  ({ slug, intent }) => {
    setIntent(appDir, slug, intent);
    return text(`set intent of "${slug}"`);
  },
);
server.tool(
  "set_nav",
  summaryOf("set_nav"),
  { slug: z.string(), nav: z.record(z.string(), z.unknown()) },
  ({ slug, nav }) => {
    setNav(appDir, slug, nav as Vow["nav"]);
    return text(`set nav of "${slug}"`);
  },
);
server.tool("remove_vow", summaryOf("remove_vow"), { slug: z.string() }, ({ slug }) => {
  removeVow(appDir, slug);
  return text(`removed vow "${slug}"`);
});

// — data (the records) —
server.tool("list_records", summaryOf("list_records"), { entity: z.string() }, ({ entity }) =>
  json(list(db, entityOf(entity))),
);
server.tool(
  "get_record",
  summaryOf("get_record"),
  { entity: z.string(), id: z.string() },
  ({ entity, id }) => {
    const r = get(db, entityOf(entity), id);
    return r ? json(r) : text(`no record "${id}"`);
  },
);
server.tool(
  "add_record",
  summaryOf("add_record"),
  { entity: z.string(), record: z.record(z.string(), z.unknown()) },
  ({ entity, record }) => json(insert(db, entityOf(entity), record)),
);
server.tool(
  "set_record_field",
  summaryOf("set_record_field"),
  { entity: z.string(), id: z.string(), field: z.string(), value: z.unknown() },
  ({ entity, id, field, value }) => {
    const r = update(db, entityOf(entity), id, { [field]: value });
    return r ? json(r) : text(`no record "${id}"`);
  },
);
server.tool(
  "remove_record",
  summaryOf("remove_record"),
  { entity: z.string(), id: z.string() },
  ({ entity, id }) =>
    text(remove(db, entityOf(entity), id) ? `removed record "${id}"` : `no record "${id}"`),
);

// — github (the plan lives as issues; gh is the source) —
server.tool("list_issues", summaryOf("list_issues"), {}, () => json(issuePlan(appDir)));
server.tool(
  "add_issue",
  summaryOf("add_issue"),
  {
    title: z.string(),
    element: z.string(),
    why: z.string(),
    labels: z.array(z.string()).optional(),
    assignee: z.string().optional(),
    milestone: z.string().optional(),
  },
  ({ title, element, why, labels, assignee, milestone }) => {
    const url = createIssue(appDir, {
      title,
      body: featureIssueBody({ element, why }),
      labels: ["enhancement", ...(labels ?? [])],
      assignee: assignee ?? "@me", // the full toolkit: assigned by default
      ...(milestone !== undefined ? { milestone } : {}),
    });
    const project = process.env["VOW_PROJECT_ID"];
    if (project !== undefined && project !== "") addToProject(appDir, project, url);
    return text(`opened ${url}${project ? " — assigned + added to the Project" : ""}`);
  },
);
server.tool("close_issue", summaryOf("close_issue"), { number: z.number() }, ({ number }) => {
  closeIssue(appDir, number);
  return text(`closed #${number}`);
});
server.tool(
  "assign_issue",
  summaryOf("assign_issue"),
  { number: z.number(), assignee: z.string() },
  ({ number, assignee }) => {
    assignIssue(appDir, number, assignee);
    return text(`assigned #${number} to ${assignee}`);
  },
);
server.tool(
  "sync_project",
  summaryOf("sync_project"),
  { project: z.string().optional() },
  ({ project }) => {
    const pid = project ?? process.env["VOW_PROJECT_ID"];
    if (pid === undefined || pid === "") {
      return text("set VOW_PROJECT_ID (in .mcp.json) or pass `project` — the Project node id");
    }
    return json(syncProjectStatus(appDir, pid));
  },
);
server.tool("studio_info", summaryOf("studio_info"), {}, () =>
  json({
    appDir,
    dbPath: resolveDbPath(dirname(appDir)),
    repo: gitRemoteUrl(appDir) ?? null,
    project: process.env["VOW_PROJECT_ID"] ?? null,
    entities: entities().map((v) => v.slug),
    views: loadVows(appDir)
      .filter((v) => v.fulfills?.kind === "emit" && v.fulfills.as === "view")
      .map((v) => v.slug),
  }),
);

await server.connect(new StdioServerTransport());
