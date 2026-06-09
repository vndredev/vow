/**
 * The MCP tool catalogue — every tool's name + one-line summary, in one place. This is the SINGLE
 * source: `server.ts` registers each tool with `summaryOf(name)`, and the docs (`docs/guide/mcp.md`)
 * list from it — a test guards that the docs name every tool, so the published list can't drift from
 * the server. Grouped read / structure (the vows) / data (the records).
 */
export interface ToolDoc {
  readonly name: string;
  readonly group: "read" | "structure" | "data";
  readonly summary: string;
}

export const TOOL_DOCS: readonly ToolDoc[] = [
  { name: "list_vows", group: "read", summary: "List every vow (slug, kind, intent)." },
  { name: "get_vow", group: "read", summary: "Get one vow by slug." },

  {
    name: "add_entity",
    group: "structure",
    summary: "Add a new entity (a data model) to the studio.",
  },
  { name: "add_field", group: "structure", summary: "Add a field to an entity." },
  { name: "remove_field", group: "structure", summary: "Remove a field from an entity by name." },
  {
    name: "add_view",
    group: "structure",
    summary: "Add a view (a page); `view` is a list of { type, value } nodes.",
  },
  { name: "set_intent", group: "structure", summary: "Set a vow's intent (the `# …` promise)." },
  {
    name: "set_nav",
    group: "structure",
    summary: "Set a vow's nav entry (label, icon, order, group).",
  },
  { name: "remove_vow", group: "structure", summary: "Delete a vow (its `.md`)." },

  { name: "list_records", group: "data", summary: "List an entity's records." },
  { name: "get_record", group: "data", summary: "Get one record by id." },
  {
    name: "add_record",
    group: "data",
    summary: "Add a record to an entity (an id is minted; absent fields get defaults).",
  },
  {
    name: "set_record_field",
    group: "data",
    summary: "Patch one field of a record (e.g. move a task by setting its status).",
  },
  { name: "remove_record", group: "data", summary: "Delete a record by id." },
];

/** The summary for a tool name — the description `server.ts` registers (empty if the name is unknown). */
export function summaryOf(name: string): string {
  return TOOL_DOCS.find((t) => t.name === name)?.summary ?? "";
}
