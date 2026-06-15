/**
 * The MCP tool catalogue — every tool's name + one-line summary, in one place. This is the SINGLE
 * source: `server.ts` registers each tool with `summaryOf(name)`, and the docs (`docs/guide/mcp.md`)
 * list from it — a test guards that the docs name every tool, so the published list can't drift from
 * the server. Grouped read / structure (the vows) / data (the records) / docs (the guide) / github (the
 * issue plan).
 */
export interface ToolDoc {
  readonly group: "code" | "data" | "docs" | "github" | "plan" | "read" | "structure";
  readonly name: string;
  readonly summary: string;
}

export const TOOL_DOCS: readonly ToolDoc[] = [
  { group: "read", name: "list_vows", summary: "List every vow (slug, kind, intent)." },
  { group: "read", name: "get_vow", summary: "Get one vow by slug." },
  {
    group: "read",
    name: "studio_info",
    summary: "The studio's paths + structure (app dir, db, repo, project, entities, views).",
  },

  {
    group: "structure",
    name: "add_entity",
    summary: "Add a new entity (a data model) to the studio.",
  },
  { group: "structure", name: "add_field", summary: "Add a field to an entity." },
  { group: "structure", name: "remove_field", summary: "Remove a field from an entity by name." },
  {
    group: "structure",
    name: "add_view",
    summary: "Add a view (a page); `view` is a list of { type, value } nodes.",
  },
  {
    group: "structure",
    name: "add_form",
    summary: "Add a form (a bound, validated `## form` over an entity): `of` + `submit`.",
  },
  {
    group: "structure",
    name: "set_field",
    summary:
      "Edit a field in place (rename, retype, required, options); a rename or retype carries the stored data.",
  },
  {
    group: "structure",
    name: "set_form",
    summary: "Edit a form's `of`/`submit`/`edit` (the singleton-editor flag) in place.",
  },
  {
    group: "structure",
    name: "set_seed",
    summary: "Replace an entity's `## seed` records (the sample data that travels with the spec).",
  },
  {
    group: "structure",
    name: "set_view",
    summary: "Replace a vow's `## view` (the page tree) in place.",
  },
  { group: "structure", name: "set_intent", summary: "Set a vow's intent (the `# …` promise)." },
  {
    group: "structure",
    name: "set_nav",
    summary: "Patch a vow's nav entry (label, icon, order, group); omitted keys keep their value.",
  },
  { group: "structure", name: "remove_vow", summary: "Delete a vow (its `.md`)." },

  { group: "data", name: "list_records", summary: "List an entity's records." },
  { group: "data", name: "get_record", summary: "Get one record by id." },
  {
    group: "data",
    name: "add_record",
    summary: "Add a record to an entity (an id is minted; absent fields get defaults).",
  },
  {
    group: "data",
    name: "set_record_field",
    summary: "Patch one field of a record (e.g. move a task by setting its status).",
  },
  { group: "data", name: "remove_record", summary: "Delete a record by id." },

  {
    group: "docs",
    name: "list_docs",
    summary: "List the guide pages the site renders (slug, title, group).",
  },
  {
    group: "docs",
    name: "read_docs",
    summary: "Read one guide page's markdown by slug (e.g. `mcp`, `primitives/button`).",
  },
  {
    group: "docs",
    name: "search_docs",
    summary: "Search the guide pages by query — matching pages with a short excerpt.",
  },

  {
    group: "github",
    name: "list_issues",
    summary: "List GitHub issues with their derived status (planned/doing/done).",
  },
  {
    group: "github",
    name: "add_issue",
    summary:
      "Open a GitHub issue (feature template + labels) — assigned, phased (the current milestone), added to the Project.",
  },
  { group: "github", name: "close_issue", summary: "Close a GitHub issue (marks it done)." },
  {
    group: "github",
    name: "reopen_issue",
    summary: "Reopen a closed GitHub issue (marks it planned/doing again).",
  },
  { group: "github", name: "assign_issue", summary: "Assign a user to a GitHub issue." },
  {
    group: "github",
    name: "sync_project",
    summary: "Sync the GitHub Project's Status field to the studio's derived status (1:1).",
  },

  {
    group: "code",
    name: "find_references",
    summary:
      "Find every semantic reference to the symbol at file:line:character (via the LSP server) — who uses it, across files, not a text match.",
  },
  {
    group: "code",
    name: "document_symbols",
    summary:
      "List the symbols a file declares (functions, classes, constants) with each one's line.",
  },
  {
    group: "code",
    name: "hover",
    summary: "The type signature + doc of the symbol at file:line:character.",
  },

  {
    group: "plan",
    name: "add_plan_item",
    summary: "Add an item to the local plan (title + optional pillar, priority, bound issue).",
  },
  {
    group: "plan",
    name: "list_plan",
    summary: "List the local plan — every item, its status + pillar.",
  },
  {
    group: "plan",
    name: "set_plan_status",
    summary:
      "Transition a plan item through the lifecycle (backlog to ready to doing to review to done).",
  },
  {
    group: "plan",
    name: "add_plan_dep",
    summary: "Add a dependency — `item` is blocked by `dependsOn` (an edge of the plan DAG).",
  },
  {
    group: "plan",
    name: "set_plan_priority",
    summary: "Re-rank a plan item (higher priority sorts first in the ready-queue).",
  },
  {
    group: "plan",
    name: "sync_plan",
    summary:
      "Pull GitHub issues in — a new open issue becomes a backlog item, a closed issue's item done.",
  },
];

/** The summary for a tool name — the description `server.ts` registers (empty if the name is unknown). */
export function summaryOf(name: string): string {
  return TOOL_DOCS.find((doc) => doc.name === name)?.summary ?? "";
}
