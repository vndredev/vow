import { execFileSync } from "node:child_process";
import type { BadgeVariant } from "./index.ts";

/**
 * The GitHub side of @vow/observability — read the plan that lives as GitHub issues. Mirrors the git
 * reads: pure parsers split from `gh`-shelling IO that returns `[]` on any failure (no `gh`, no auth, no
 * network), so a build without GitHub just has no issue plan. A vow's plan derives from this — never hand-set.
 */

/** An issue's derived plan status — the board's three columns. */
export type IssueStatus = "planned" | "doing" | "done";

/** A GitHub issue, reduced to what the plan needs. */
export interface GitHubIssue {
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed";
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
}

/** An open pull request, reduced to what links it back to its issues. */
export interface GitHubPr {
  readonly number: number;
  readonly title: string;
  readonly body: string;
}

interface RawIssue {
  number: number;
  title: string;
  state: string;
  labels?: { name?: string }[];
  assignees?: { login?: string }[];
}

/** Parse `gh issue list --json number,title,state,labels,assignees` → issues (state lower-cased,
    labels/assignees flattened to names). Pure; `[]` on malformed input. */
export function parseIssues(json: string): GitHubIssue[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return (raw as RawIssue[]).map((i) => ({
    number: i.number,
    title: i.title,
    state: i.state.toLowerCase() === "closed" ? "closed" : "open",
    labels: (i.labels ?? []).map((l) => l.name ?? "").filter((n) => n !== ""),
    assignees: (i.assignees ?? []).map((a) => a.login ?? "").filter((n) => n !== ""),
  }));
}

interface RawPr {
  number: number;
  title: string;
  body?: string;
}

/** Parse `gh pr list --json number,title,body` → PRs. Pure; `[]` on malformed input. */
export function parsePrs(json: string): GitHubPr[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return (raw as RawPr[]).map((p) => ({ number: p.number, title: p.title, body: p.body ?? "" }));
}

const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;

/** The issue numbers a PR body closes — GitHub's keywords (`Closes #12`, `Fixes #3`, `Resolves #9`). Pure. */
export function linkedIssues(body: string): number[] {
  const out: number[] = [];
  for (const m of body.matchAll(CLOSING)) {
    const n = Number(m[1]);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** An issue's status: closed → `done`; open with an open PR that closes it → `doing`; else `planned`. Pure. */
export function deriveIssueStatus(
  issue: GitHubIssue,
  inProgress: ReadonlySet<number>,
): IssueStatus {
  if (issue.state === "closed") return "done";
  return inProgress.has(issue.number) ? "doing" : "planned";
}

const STATUS_VARIANT: Readonly<Record<IssueStatus, BadgeVariant>> = {
  planned: "neutral",
  doing: "accent",
  done: "success",
};

/** The Badge variant for an issue status (planned → neutral, doing → accent, done → success). */
export function statusVariant(status: IssueStatus): BadgeVariant {
  return STATUS_VARIANT[status];
}

/** All issues (open + closed) via `gh`. Returns `[]` (never throws) when `gh`/auth/network is absent. */
export function githubIssues(cwd: string): GitHubIssue[] {
  try {
    const out = execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--json",
        "number,title,state,labels,assignees",
        "--state",
        "all",
        "--limit",
        "200",
      ],
      { cwd, encoding: "utf8" },
    );
    return parseIssues(out);
  } catch {
    return [];
  }
}

/** Open pull requests via `gh`. Returns `[]` (never throws) when `gh`/auth/network is absent. */
export function githubPrs(cwd: string): GitHubPr[] {
  try {
    const out = execFileSync(
      "gh",
      ["pr", "list", "--json", "number,title,body", "--state", "open", "--limit", "200"],
      { cwd, encoding: "utf8" },
    );
    return parsePrs(out);
  } catch {
    return [];
  }
}

/** One issue on the plan, with its derived status. */
export interface PlanItem {
  readonly issue: GitHubIssue;
  readonly status: IssueStatus;
}

/**
 * The issue plan — every issue with its derived status (planned/doing/done), as `gh` returns them
 * (newest first). An open issue is `doing` when an open PR closes it (`Closes #N`), else `planned`; a
 * closed issue is `done`. This is what the board + roadmap read instead of hand-seeded task records.
 */
export function issuePlan(cwd: string): PlanItem[] {
  const inProgress = new Set<number>();
  for (const pr of githubPrs(cwd)) {
    for (const n of linkedIssues(pr.body)) inProgress.add(n);
  }
  return githubIssues(cwd).map((issue) => ({
    issue,
    status: deriveIssueStatus(issue, inProgress),
  }));
}
