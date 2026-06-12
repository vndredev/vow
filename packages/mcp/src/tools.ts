/**
 * The MCP tool catalogue — every tool's name + one-line summary, in one place. This is the SINGLE
 * source: `server.ts` registers each tool with `summaryOf(name)`, and the docs (`docs/guide/mcp.md`)
 * list from it — a test guards that the docs name every tool, so the published list can't drift from
 * the server. Grouped read / structure (the vows) / data (the records) / github (the issue plan).
 */
export interface ToolDoc {
  readonly group: "data" | "github" | "read" | "structure";
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
      "Edit a field in place (rename, retype, required, options); a rename carries the data.",
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
    group: "github",
    name: "list_issues",
    summary: "List GitHub issues with their derived status (planned/doing/done).",
  },
  {
    group: "github",
    name: "add_issue",
    summary: "Open a GitHub issue (feature template + labels) — assigned + added to the Project.",
  },
  { group: "github", name: "close_issue", summary: "Close a GitHub issue (marks it done)." },
  { group: "github", name: "assign_issue", summary: "Assign a user to a GitHub issue." },
  {
    group: "github",
    name: "sync_project",
    summary: "Sync the GitHub Project's Status field to the studio's derived status (1:1).",
  },
];

/** The summary for a tool name — the description `server.ts` registers (empty if the name is unknown). */
export function summaryOf(name: string): string {
  return TOOL_DOCS.find((doc) => doc.name === name)?.summary ?? "";
}
