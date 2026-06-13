import type { Maybe } from "./types.ts";
import { NONE } from "./none.ts";
import { execFileSync } from "node:child_process";

/**
 * The GitHub Project's Roadmap view config — vow's plan-on-GitHub invariant. A spike (#539) confirmed the
 * Projects v2 API exposes NO mutation to set a view's config (it is UI-only), and reads back only `layout`
 * + the group-by field. So vow DECLARES the target here, and `vow doctor` checks what's readable (layout +
 * group-by → a real ok/drift verdict) and CHECKLISTS the rest (the date field + markers, which the API
 * does not expose at all). No `apply` — there is nothing to apply through.
 */

/**
 * The target Roadmap view config — the invariant `vow doctor` checks the live view against. Only `groupBy`
 * is API-readable (so it gets a real ✓/✗); `dateField` (the lever that plots each item on the timeline at
 * its phase date) and `markers` (a vertical line per phase due date) are UI-only — doctor lists them.
 */
export const ROADMAP_VIEW_TARGET = {
  dateField: "Milestone",
  groupBy: "Milestone",
  markers: "Milestones",
} as const;

/** The live Roadmap view, reduced to what the API exposes — its layout + group-by ("" when ungrouped). */
export interface RoadmapView {
  readonly groupBy: string;
  readonly layout: string;
}

const ROADMAP_QUERY =
  "query($id:ID!){node(id:$id){... on ProjectV2{views(first:20){nodes{layout " +
  "groupByFields(first:1){nodes{... on ProjectV2FieldCommon{name}}}}}}}}";

const ROADMAP_JQ =
  '.data.node.views.nodes[] | select(.layout=="ROADMAP_LAYOUT") | ' +
  '{layout: .layout, groupBy: (.groupByFields.nodes[0].name // "")}';

/** A non-null object — the guard to walk an untrusted `gh` payload without an unsafe cast. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A string field off a record, or "" when absent / not a string. */
function strField(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/** Parse the `gh --jq` Roadmap-view object (`{layout, groupBy}`) — `NONE` when no roadmap view exists
    (empty output) or the shape is malformed. Pure. */
export function parseRoadmapView(json: string): Maybe<RoadmapView> {
  const trimmed = json.trim();
  if (trimmed === "") {
    return NONE;
  }
  try {
    const raw: unknown = JSON.parse(trimmed);
    if (isRecord(raw)) {
      return { groupBy: strField(raw, "groupBy"), layout: strField(raw, "layout") };
    }
  } catch {
    return NONE;
  }
  return NONE;
}

/** Read the Project's Roadmap view via `gh` — its layout + group-by field. `NONE` when no ROADMAP_LAYOUT
    view exists or `gh`/auth/network is absent. */
export function readRoadmapView(cwd: string, projectId: string): Maybe<RoadmapView> {
  try {
    const out = execFileSync(
      "gh",
      [
        "api",
        "graphql",
        "-f",
        `query=${ROADMAP_QUERY}`,
        "-f",
        `id=${projectId}`,
        "--jq",
        ROADMAP_JQ,
      ],
      { cwd, encoding: "utf8" },
    );
    return parseRoadmapView(out);
  } catch {
    return NONE;
  }
}

/** A `vow doctor` check line — `ok` holds, `drift` is auto-detectable + wrong (fixable), `manual` is a
    UI-only step the API can't set or read (a checklist item the human applies in the Roadmap toolbar). */
export type CheckStatus = "drift" | "manual" | "ok";
export interface Check {
  readonly status: CheckStatus;
  readonly text: string;
}

/** The group-by check — `ok` when the live view groups by Milestone, else `drift` naming what it groups by
    (or "nothing") and the fix. The one readable verdict among the view's config. */
function groupByCheck(groupBy: string): Check {
  if (groupBy === ROADMAP_VIEW_TARGET.groupBy) {
    return { status: "ok", text: "grouped by Milestone" };
  }
  let by = groupBy;
  if (by === "") {
    by = "nothing";
  }
  return { status: "drift", text: `grouped by ${by} — set Group by → Milestone` };
}

/** The Roadmap view checks — what's readable becomes a real ok/drift verdict, what's UI-only becomes a
    checklist line. Pure: given the live view (or `NONE`), return the checks `vow doctor` prints. */
export function roadmapViewChecks(live: Maybe<RoadmapView>): Check[] {
  if (typeof live !== "object") {
    return [
      { status: "drift", text: "no ROADMAP_LAYOUT view on the Project — add a Roadmap view" },
    ];
  }
  return [
    { status: "ok", text: "the Roadmap view exists (ROADMAP_LAYOUT)" },
    groupByCheck(live.groupBy),
    { status: "manual", text: "Date field → Milestone (UI-only: Roadmap toolbar → Date fields)" },
    { status: "manual", text: "Markers → Milestones (UI-only: Roadmap toolbar → Markers)" },
  ];
}
