import type {
  BadgeVariant,
  GitHubIssue,
  GitHubPr,
  IssueStatus,
  Maybe,
  Milestone,
  PlanItem,
} from "./types.ts";
import { NONE } from "./none.ts";
import { execFileSync } from "node:child_process";

/**
 * The GitHub side of @vow/observability — read the plan that lives as GitHub issues. Mirrors the git
 * reads: pure parsers split from `gh`-shelling IO that returns `[]` on any failure (no `gh`, no auth, no
 * network), so a build without GitHub just has no issue plan. A vow's plan derives from this — never hand-set.
 */

export type { GitHubIssue, GitHubPr, IssueStatus, Milestone, PlanItem } from "./types.ts";

interface RawLabel {
  readonly name?: string;
}

interface RawAssignee {
  readonly login?: string;
}

interface RawMilestone {
  readonly dueOn?: Maybe<string>;
  readonly title?: string;
}

interface RawIssue {
  readonly assignees?: readonly RawAssignee[];
  readonly labels?: readonly RawLabel[];
  readonly milestone?: Maybe<RawMilestone>;
  readonly number?: number;
  readonly state?: string;
  readonly title?: string;
}

const ISSUE_NOT_FOUND = 0;

interface RawPr {
  readonly body?: string;
  readonly number: number;
  readonly title: string;
}

/** Parse a JSON string expected to be an array, mapping each element through `lift`; `[]` on any
    malformation. The `lift` carries the element type, so each parser stays type-safe. Pure. */
function parseJsonArray<T>(json: string, lift: (element: RawIssue & RawPr) => T): readonly T[] {
  let raw: unknown = NONE;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const elements: readonly (RawIssue & RawPr)[] = raw;
  return elements.map((element) => lift(element));
}

/** Lift a raw milestone into the plan's shape, dropping a missing `dueOn`. */
function liftMilestone(milestone: Maybe<RawMilestone>): Maybe<Milestone> {
  const title = milestone?.title;
  if (typeof title !== "string") {
    return NONE;
  }
  const dueOn = milestone?.dueOn;
  if (typeof dueOn === "string") {
    return { dueOn, title };
  }
  return { title };
}

/** The number a raw issue carries, or the not-found sentinel when absent. */
function liftNumber(raw: RawIssue): number {
  const num = raw.number;
  if (typeof num === "number") {
    return num;
  }
  return ISSUE_NOT_FOUND;
}

/** A raw issue's state, lower-cased to the plan's two-value union. */
function liftState(raw: RawIssue): "open" | "closed" {
  if ((raw.state ?? "").toLowerCase() === "closed") {
    return "closed";
  }
  return "open";
}

/** A raw issue's title, or the empty string when absent. */
function liftTitle(raw: RawIssue): string {
  const { title } = raw;
  if (typeof title === "string") {
    return title;
  }
  return "";
}

/** The optional `milestone` field of an issue, present only when a milestone was lifted. */
function milestoneField(milestone: Maybe<Milestone>): { milestone?: Milestone } {
  if (typeof milestone === "object") {
    return { milestone };
  }
  return {};
}

/** The names a raw `labels`/`assignees` array carries, dropping empties; `[]` when it is not an array. */
function names<T>(raw: Maybe<readonly T[]>, pick: (entry: T) => Maybe<string>): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const list: readonly T[] = raw;
  return list.map((entry) => pick(entry) ?? "").filter((name) => name !== "");
}

/** Flatten one raw issue into the plan's shape — state lower-cased, labels/assignees reduced to names. */
function liftIssue(raw: RawIssue): GitHubIssue {
  const labels = names(raw.labels, (label) => label.name);
  const assignees = names(raw.assignees, (assignee) => assignee.login);
  return {
    assignees,
    labels,
    ...milestoneField(liftMilestone(raw.milestone)),
    number: liftNumber(raw),
    state: liftState(raw),
    title: liftTitle(raw),
  };
}

/**
 * Parse `gh issue list --json number,title,state,labels,assignees` -> issues (state lower-cased,
 * labels/assignees flattened to names). Pure; `[]` on malformed input.
 */
export function parseIssues(json: string): GitHubIssue[] {
  return [...parseJsonArray(json, (raw) => liftIssue(raw))];
}

/** Parse `gh pr list --json number,title,body` -> PRs. Pure; `[]` on malformed input. */
export function parsePrs(json: string): GitHubPr[] {
  return [
    ...parseJsonArray(json, (pr) => ({
      body: pr.body ?? "",
      number: pr.number,
      title: pr.title,
    })),
  ];
}

const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/giu;

/** The issue numbers a PR body closes — GitHub's keywords (`Closes #12`, `Fixes #3`, `Resolves #9`). Pure. */
export function linkedIssues(body: string): number[] {
  const out: number[] = [];
  for (const match of body.matchAll(CLOSING)) {
    const num = Number(match[1]);
    if (!out.includes(num)) {
      out.push(num);
    }
  }
  return out;
}

/** An issue's status: closed -> `done`; open with an open PR that closes it -> `doing`; else `planned`. The
    `inProgress` numbers are the issues an open PR closes. Pure. */
export function deriveIssueStatus(
  issue: Readonly<GitHubIssue>,
  inProgress: readonly number[],
): IssueStatus {
  if (issue.state === "closed") {
    return "done";
  }
  if (inProgress.includes(issue.number)) {
    return "doing";
  }
  return "planned";
}

const STATUS_VARIANT: Readonly<Record<IssueStatus, BadgeVariant>> = {
  doing: "accent",
  done: "success",
  planned: "neutral",
};

/** The Badge variant for an issue status (planned -> neutral, doing -> accent, done -> success). */
export function statusVariant(status: IssueStatus): BadgeVariant {
  return STATUS_VARIANT[status];
}

const ISSUE_LIMIT = "200";

/** All issues (open + closed) via `gh`. Returns `[]` (never throws) when `gh`/auth/network is absent. */
export function githubIssues(cwd: string): GitHubIssue[] {
  try {
    const out = execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--json",
        "number,title,state,labels,assignees,milestone",
        "--state",
        "all",
        "--limit",
        ISSUE_LIMIT,
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
      ["pr", "list", "--json", "number,title,body", "--state", "open", "--limit", ISSUE_LIMIT],
      { cwd, encoding: "utf8" },
    );
    return parsePrs(out);
  } catch {
    return [];
  }
}

/**
 * The issue plan — every issue with its derived status (planned/doing/done), as `gh` returns them
 * (newest first). An open issue is `doing` when an open PR closes it (`Closes #N`), else `planned`; a
 * closed issue is `done`. This is what the board + roadmap read instead of hand-seeded task records.
 */
export function issuePlan(cwd: string): PlanItem[] {
  const inProgress = new Set<number>();
  for (const pr of githubPrs(cwd)) {
    for (const num of linkedIssues(pr.body)) {
      inProgress.add(num);
    }
  }
  const closing = [...inProgress];
  return githubIssues(cwd).map((issue) => ({
    issue,
    status: deriveIssueStatus(issue, closing),
  }));
}

/*
 * The write side: the agent acts on the plan. Writes throw on failure (unlike the reads, which
 * degrade to `[]`) — opening or moving an issue is an effect the caller must know succeeded.
 */

/** The default strand attribution for an agent-opened feature issue. */
const DEFAULT_STRAND = "generation · author layer";

/**
 * The feature-template body (fills `.github/ISSUE_TEMPLATE/feature.md`'s sections), so an issue the
 * agent opens passes the template gate instead of tripping it. Pure.
 */
export function featureIssueBody(
  input: Readonly<{ element: string; strand?: string; why: string }>,
): string {
  const strand = input.strand ?? DEFAULT_STRAND;
  return [
    `**Strand / roadmap item** (${strand}) — see the [roadmap](../../docs/guide/changelog.md)`,
    ``,
    `**The element / function** — ${input.element}`,
    ``,
    `**Why** — ${input.why}`,
    ``,
  ].join("\n");
}

/** The fields an agent supplies to open a feature issue. */
export interface CreateIssueInput {
  readonly assignee?: string;
  readonly body: string;
  readonly labels?: readonly string[];
  readonly milestone?: string;
  readonly title: string;
}

/** A `--flag value` pair when `value` is present, else nothing — the building block for the options. */
function flag(name: string, value: Maybe<string>): readonly string[] {
  if (typeof value === "string" && value !== "") {
    return [name, value];
  }
  return [];
}

/** The `gh issue create` flags for the optional label/assignee/milestone of an issue. */
function createIssueOptions(input: Readonly<CreateIssueInput>): readonly string[] {
  const { assignee, labels, milestone } = input;
  return [
    ...flag("--label", (labels ?? []).join(",")),
    ...flag("--assignee", assignee),
    ...flag("--milestone", milestone),
  ];
}

/** Open an issue via `gh` (title + body + labels + assignee + milestone) -> its URL. Throws on failure. */
export function createIssue(cwd: string, input: Readonly<CreateIssueInput>): string {
  const args = [
    "issue",
    "create",
    "--title",
    input.title,
    "--body",
    input.body,
    ...createIssueOptions(input),
  ];
  return execFileSync("gh", args, { cwd, encoding: "utf8" }).trim();
}

/** Close an issue via `gh` (-> `done`). Throws on failure. */
export function closeIssue(cwd: string, issue: number): void {
  execFileSync("gh", ["issue", "close", String(issue)], { cwd, encoding: "utf8" });
}

/** Assign a user to an issue via `gh`. Throws on failure. */
export function assignIssue(cwd: string, issue: number, login: string): void {
  execFileSync("gh", ["issue", "edit", String(issue), "--add-assignee", login], {
    cwd,
    encoding: "utf8",
  });
}
