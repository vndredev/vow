/* oxlint-disable consistent-type-specifier-style -- one mixed import per module; separate trips no-duplicate-imports */
import { type Maybe, isRecord } from "@vow/core";
/* oxlint-enable consistent-type-specifier-style */
import { createIssue, resolveCurrentPhase } from "@vow/observability";
import { mkdirSync, writeFileSync } from "node:fs";
import { NONE } from "./none.ts";
import path from "node:path";

/**
 * The in-app reporter's server side — parse a posted report + file it as a real vow issue. An issue is a
 * **bug** OR a **feature** (the overlay's two menu choices); each maps to its label, and the issue is
 * phased by the milestone gate (`resolveCurrentPhase`) so it lands on the roadmap, not in "No milestone".
 * The body names the bug/feature AREA — the vow source the picker resolved, the route, the element hint —
 * so the agent knows which `.vow.md` / view to touch.
 */

/** An issue is a bug or a feature; each kind carries the label `gh issue create` applies. */
const KIND_LABEL = { bug: "bug", feature: "enhancement" } as const;

/** The kinds the overlay can report. */
export type IssueKind = keyof typeof KIND_LABEL;

/** A validated report — what the overlay POSTs, narrowed to the fields the issue needs. */
export interface ReportInput {
  readonly kind: IssueKind;
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly route: string;
  readonly element: string;
  /** A PNG data URL of the page, or "" when none — saved to `.vow/bugs/` + referenced in the body. */
  readonly screenshot: string;
}

/** A string field off an untrusted record, or "" when absent / not a string. */
function fieldOf(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/** Parse + validate a posted report — `NONE` when malformed, an unknown kind, or a missing title. Pure. */
export function parseReport(raw: string): Maybe<ReportInput> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return NONE;
    }
    const kind = fieldOf(parsed, "kind");
    const title = fieldOf(parsed, "title");
    if ((kind !== "bug" && kind !== "feature") || title === "") {
      return NONE;
    }
    return {
      description: fieldOf(parsed, "description"),
      element: fieldOf(parsed, "element"),
      kind,
      route: fieldOf(parsed, "route"),
      screenshot: fieldOf(parsed, "screenshot"),
      source: fieldOf(parsed, "source"),
      title,
    };
  } catch {
    return NONE;
  }
}

/** The prefix of a base64 PNG data URL (what `html-to-image` produces). */
const PNG_PREFIX = "data:image/png;base64,";

/** Save a PNG data URL to `.vow/bugs/<ts>.png` (gitignored), returning its repo-relative path; `NONE` for
    an empty / non-PNG payload (filing never blocks on a screenshot). */
function saveScreenshot(cwd: string, dataUrl: string): Maybe<string> {
  if (!dataUrl.startsWith(PNG_PREFIX)) {
    return NONE;
  }
  const rel = path.join(".vow", "bugs", `${Date.now()}.png`);
  mkdirSync(path.join(cwd, ".vow", "bugs"), { recursive: true });
  writeFileSync(path.join(cwd, rel), Buffer.from(dataUrl.slice(PNG_PREFIX.length), "base64"));
  return rel;
}

/** The issue body — the description, the AREA the picker resolved (vow source · route · element), and the
    saved screenshot path when there is one. */
export function reportBody(report: Readonly<ReportInput>, shot: Maybe<string>): string {
  const lines = [
    report.description || "_No description._",
    "",
    `**Area** — vow \`${report.source || "—"}\` · \`${report.route}\` · \`${report.element}\``,
  ];
  if (typeof shot === "string") {
    lines.push(`**Screenshot** — \`${shot}\``);
  }
  lines.push("", "_Filed from vow's in-app reporter._");
  return lines.join("\n");
}

/** The milestone fragment — the current phase when one resolves, so the issue is filed phased (else bare). */
function phasePart(cwd: string): { readonly milestone?: string } {
  const phase = resolveCurrentPhase(cwd);
  if (typeof phase === "string" && phase !== "") {
    return { milestone: phase };
  }
  return {};
}

/** File a report as a real vow issue (phased, labelled by kind), saving its screenshot to `.vow/bugs/` —
    returns the issue URL. Throws on a `gh` error. */
export function reportIssue(cwd: string, report: Readonly<ReportInput>): string {
  const shot = saveScreenshot(cwd, report.screenshot);
  return createIssue(cwd, {
    body: reportBody(report, shot),
    labels: [KIND_LABEL[report.kind]],
    title: report.title,
    ...phasePart(cwd),
  });
}
