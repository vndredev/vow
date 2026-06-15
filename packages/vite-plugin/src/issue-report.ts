/* oxlint-disable consistent-type-specifier-style -- one mixed import per module; separate trips no-duplicate-imports */
import { type Maybe, isRecord } from "@vow/core";
/* oxlint-enable consistent-type-specifier-style */
import { createIssue, githubIssues } from "@vow/observability";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { NONE } from "./none.ts";
import path from "node:path";

/**
 * The in-app reporter's server side — parse a posted report + file it as a real vow issue. An issue is a
 * **bug** OR a **feature** (the overlay's two menu choices); each maps to its label. The body names the
 * bug/feature AREA — the vow source the picker resolved, the route, the element hint — so the agent knows
 * which `.vow.md` / view to touch. The issue's pillar lives on the local plan once it syncs in.
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

/** Where the reporter's screenshots live — `.vow/issues/<issue>.png` (gitignored). Named for issues, not
    "bugs", since a report is a bug OR a feature; keyed by the issue NUMBER so the cleanup can prune it. */
const SHOTS_DIR = path.join(".vow", "issues");

/** Save a PNG data URL to `.vow/issues/<issue>.png` — a no-op for an empty / non-PNG payload, so filing
    never blocks on a screenshot. Keyed by the issue number (the cleanup prunes by it). */
function saveScreenshot(cwd: string, dataUrl: string, issue: number): void {
  if (!dataUrl.startsWith(PNG_PREFIX)) {
    return;
  }
  mkdirSync(path.join(cwd, SHOTS_DIR), { recursive: true });
  const png = Buffer.from(dataUrl.slice(PNG_PREFIX.length), "base64");
  writeFileSync(path.join(cwd, SHOTS_DIR, `${issue}.png`), png);
}

/** The issue number in a `gh issue create` URL (its trailing path segment), or `NONE`. Pure. */
export function issueNumber(url: string): Maybe<number> {
  const match = /\/(\d+)$/u.exec(url.trim());
  if (match === null) {
    return NONE;
  }
  return Number(match[1]);
}

/** The screenshot files (`<n>.png`) whose issue number is not in `open` — the ones to prune. Pure. */
export function orphanShots(files: readonly string[], open: readonly number[]): string[] {
  return files.filter((file) => {
    const match = /^(\d+)\.png$/u.exec(file);
    return match !== null && !open.includes(Number(match[1]));
  });
}

/** Remove each named file from `dir` (the prune step, kept out of `cleanIssueShots` for the statement cap). */
function removeShots(dir: string, files: readonly string[]): void {
  for (const file of files) {
    rmSync(path.join(dir, file));
  }
}

/** Prune `.vow/issues/<n>.png` for every issue no longer open (closed or deleted), so the folder stays in
    step with the plan — returns how many were removed. A no-op when `gh` yields nothing (never mass-delete
    on a network hiccup, which would read as "no issues open"). */
export function cleanIssueShots(cwd: string): number {
  const dir = path.join(cwd, SHOTS_DIR);
  if (!existsSync(dir)) {
    return 0;
  }
  const issues = githubIssues(cwd);
  if (issues.length === 0) {
    return 0;
  }
  const open = issues.filter((issue) => issue.state === "open").map((issue) => issue.number);
  const orphans = orphanShots(readdirSync(dir), open);
  removeShots(dir, orphans);
  return orphans.length;
}

/** The auto-resolved context — the vow AREA the picker found, plus a note when a screenshot was saved (at
    `.vow/issues/<this issue>.png`, keyed by number after the issue is created). */
function contextLines(report: Readonly<ReportInput>): string {
  const area = `vow \`${report.source || "—"}\` · route \`${report.route}\` · element \`${report.element}\``;
  if (report.screenshot !== "") {
    return `${area}\n\n_A screenshot of the element is saved locally under \`.vow/issues/\`._`;
  }
  return area;
}

/** A bug report filled into the bug template (`.github/ISSUE_TEMPLATE/bug.md`) so the issue-template gate
    passes and the studio plan reads its sections. */
function bugBody(report: Readonly<ReportInput>): string {
  return [
    "**What happened** (vs. what the docs say)",
    "",
    report.description || "_(see the screenshot)_",
    "",
    "**A minimal `app/*.vow.md`** that reproduces it",
    "",
    contextLines(report),
    "",
    "**Relevant output** of `vp check` / `pnpm -r test`",
    "",
    "_Filed from vow's in-app reporter._",
    "",
    "**Environment**: vow dev (the in-app reporter)",
  ].join("\n");
}

/** A feature report filled into the feature template (`.github/ISSUE_TEMPLATE/feature.md`) — the `What` /
    `Why` / `Strand` sections the gate + the studio plan expect. */
function featureBody(report: Readonly<ReportInput>): string {
  return [
    `**What** — ${report.description || report.title}`,
    "",
    "**Why** — proposed from the running app via the in-app reporter.",
    "",
    contextLines(report),
    "",
    "---",
    "",
    "_Strand: generation · author layer_",
  ].join("\n");
}

/** The issue body — filled into the bug OR feature template (by kind) so the issue-template gate passes,
    carrying the resolved vow area. */
export function reportBody(report: Readonly<ReportInput>): string {
  if (report.kind === "bug") {
    return bugBody(report);
  }
  return featureBody(report);
}

/** File a report as a real vow issue (labelled by kind), save its screenshot to `.vow/issues/<n>.png`
    (keyed by the new issue number), and prune the screenshots of any closed/deleted issues. Returns the
    issue URL. Throws on a `gh` create error. */
export function reportIssue(cwd: string, report: Readonly<ReportInput>): string {
  const url = createIssue(cwd, {
    body: reportBody(report),
    labels: [KIND_LABEL[report.kind]],
    title: report.title,
  });
  const number = issueNumber(url);
  if (typeof number === "number") {
    saveScreenshot(cwd, report.screenshot, number);
  }
  cleanIssueShots(cwd);
  return url;
}
