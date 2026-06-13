import type {
  AgentSession,
  BadgeVariant,
  GitHubIssue,
  GitHubPr,
  IssueDetail,
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

export type {
  AgentSession,
  GitHubIssue,
  GitHubPr,
  IssueDetail,
  IssueStatus,
  Milestone,
  PlanItem,
} from "./types.ts";

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

/** Parse a JSON string expected to be an array, mapping each element through `lift`; `[]` on any
    malformation. Non-object elements are filtered out (not coerced to a record), so `lift` only ever sees
    an object — its fields stay `unknown` (only `RawIssue`'s all-optional shape), so a `lift` reading a
    field must re-validate it rather than trust a predicate that never checked it. Pure. */
function parseJsonArray<T>(json: string, lift: (element: RawIssue) => T): readonly T[] {
  let raw: unknown = NONE;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: readonly unknown[] = raw;
  return items
    .filter((element): element is RawIssue => typeof element === "object" && element !== null)
    .map((element) => lift(element));
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

/** The issue's body when present + a string, else empty. */
function bodyOf(raw: object): string {
  if ("body" in raw && typeof raw.body === "string") {
    return raw.body;
  }
  return "";
}

/** A raw object's `url` when present + a string, else empty — read defensively, as the shared predicate
    asserts neither a PR's `url` nor its presence. */
function urlOf(raw: object): string {
  if ("url" in raw && typeof raw.url === "string") {
    return raw.url;
  }
  return "";
}

/** A raw object's `isDraft` — true only when present + exactly the boolean `true`, else false. Read
    defensively (the shared predicate asserts no PR field): a payload without `isDraft` is a ready PR. */
function isDraftOf(raw: object): boolean {
  return "isDraft" in raw && raw.isDraft === true;
}

/** Lift one raw element into a PR — number/title re-validated (as the issue path does), body/url/isDraft read
    defensively. The shared predicate narrows only to `RawIssue` (no non-optional PR field), so a malformed
    payload yields the not-found number + empty strings rather than `undefined` typed as a valid `GitHubPr`. */
function liftPr(raw: RawIssue): GitHubPr {
  return {
    body: bodyOf(raw),
    isDraft: isDraftOf(raw),
    number: liftNumber(raw),
    title: liftTitle(raw),
    url: urlOf(raw),
  };
}

/** Parse `gh pr list --json number,title,body,url,isDraft` -> PRs. Pure; `[]` on malformed input. */
export function parsePrs(json: string): GitHubPr[] {
  return [...parseJsonArray(json, (pr) => liftPr(pr))];
}

/** Parse a `gh issue view --json number,title,body` object. Pure; throws on malformed input. */
export function parseIssueDetail(json: string): IssueDetail {
  const raw: unknown = JSON.parse(json);
  if (
    typeof raw === "object" &&
    raw !== null &&
    "number" in raw &&
    typeof raw.number === "number" &&
    "title" in raw &&
    typeof raw.title === "string"
  ) {
    return { body: bodyOf(raw), number: raw.number, title: raw.title };
  }
  throw new Error("malformed issue JSON");
}

/** One issue's developable detail via `gh issue view <n> --json number,title,body`. */
export function issueDetail(cwd: string, issue: number): IssueDetail {
  const out = execFileSync("gh", ["issue", "view", String(issue), "--json", "number,title,body"], {
    cwd,
    encoding: "utf8",
  });
  return parseIssueDetail(out);
}

/** The non-empty lines of gh's `--jq .labels[].name` output — an issue's label names. Pure. */
export function parseLabels(out: string): readonly string[] {
  return out.split("\n").filter((line) => line !== "");
}

/** One issue's label names via `gh issue view <n> --json labels --jq .labels[].name` — so the area router
 *  can pick the specialized agent for the issue's `area:` label. */
export function issueLabels(cwd: string, issue: number): readonly string[] {
  const args = ["issue", "view", String(issue), "--json", "labels", "--jq", ".labels[].name"];
  return parseLabels(execFileSync("gh", args, { cwd, encoding: "utf8" }));
}

const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+((?:#\d+[\s,]*)+)/giu;

/** A `#N` reference inside a closing clause's list. */
const ISSUE_REF = /#(\d+)/gu;

/** The issue numbers in a closing clause's `#N` list (`#111, #112` -> [111, 112]). */
function refsIn(clause: string): number[] {
  return [...clause.matchAll(ISSUE_REF)].map((ref: readonly string[]) => Number(ref[1]));
}

/**
 * The issue numbers a PR body closes — GitHub's keywords (`Closes #12`, `Fixes #3`), INCLUDING a
 * comma-separated list after one keyword (`Closes #111, #112` -> both). GitHub's own auto-close only takes
 * the FIRST of such a list, so this is also what the reconcile uses to find the issues it missed. Pure.
 */
export function linkedIssues(body: string): number[] {
  const out: number[] = [];
  for (const clause of body.matchAll(CLOSING)) {
    for (const num of refsIn(clause[1] ?? "")) {
      if (!out.includes(num)) {
        out.push(num);
      }
    }
  }
  return out;
}

/** The label an agent applies to an issue while it is actively developing it — so the board shows the issue
    as `doing` from the moment the agent claims it (opens its worktree), not only once its PR exists. The
    agent removes it when the run ends; an open PR's `Closes #N` then carries the `doing` signal onward. */
export const IN_PROGRESS_LABEL = "in-progress";

/** An issue's status: closed -> `done`; open with an open PR that closes it OR the `in-progress` label (an
    agent is developing it right now) -> `doing`; else `planned`. The `inProgress` numbers are the issues an
    open PR closes — so the board shows `doing` across the whole develop -> PR -> merge arc. Pure. */
export function deriveIssueStatus(
  issue: Readonly<GitHubIssue>,
  inProgress: readonly number[],
): IssueStatus {
  if (issue.state === "closed") {
    return "done";
  }
  if (inProgress.includes(issue.number) || issue.labels.includes(IN_PROGRESS_LABEL)) {
    return "doing";
  }
  return "planned";
}

/**
 * Index every open NON-DRAFT PR by each issue its body closes (`Closes #N`) -> the agent session for that
 * issue (its number + the URL the human watches the run at). The first PR that claims an issue wins. Pure —
 * the gh-direct read in `issuePlan` feeds it; the board renders the link for a `doing` issue.
 *
 * A DRAFT PR is skipped: it is a red develop run parked for a human, not an active session. Counting its
 * `Closes #N` would derive the issue as `doing` and pin it "In Progress" forever — the exact stuck-board bug
 * a failed run leaves behind. So a draft drops its issue back to `planned` (it awaits a fresh attempt).
 */
export function sessionsByIssue(prs: readonly GitHubPr[]): Map<number, AgentSession> {
  const sessions = new Map<number, AgentSession>();
  const ready = prs.filter((pr) => !pr.isDraft);
  for (const pr of ready) {
    for (const num of linkedIssues(pr.body)) {
      if (!sessions.has(num)) {
        sessions.set(num, { number: pr.number, url: pr.url });
      }
    }
  }
  return sessions;
}

/** Build one plan item — its issue, derived status, and (only when present) the agent session that's
    redeeming it. Returns the whole item so `issuePlan`'s map never spreads an object per iteration. Pure. */
function planItem(
  issue: Readonly<GitHubIssue>,
  closing: readonly number[],
  session: Maybe<AgentSession>,
): PlanItem {
  const status = deriveIssueStatus(issue, closing);
  if (typeof session === "object") {
    return { issue, session, status };
  }
  return { issue, status };
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
      [
        "pr",
        "list",
        "--json",
        "number,title,body,url,isDraft",
        "--state",
        "open",
        "--limit",
        ISSUE_LIMIT,
      ],
      { cwd, encoding: "utf8" },
    );
    return parsePrs(out);
  } catch {
    return [];
  }
}

/** Merged pull requests via `gh`. Returns `[]` (never throws) when `gh`/auth/network is absent. */
export function mergedPrs(cwd: string): GitHubPr[] {
  try {
    const out = execFileSync(
      "gh",
      ["pr", "list", "--json", "number,title,body", "--state", "merged", "--limit", ISSUE_LIMIT],
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
 * closed issue is `done`. A `doing` issue also carries the agent session (the open PR + its URL), so the
 * board can link the human to the run. This is what the board + roadmap read instead of hand-seeded tasks.
 */
export function issuePlan(cwd: string): PlanItem[] {
  const sessions = sessionsByIssue(githubPrs(cwd));
  const closing = [...sessions.keys()];
  return githubIssues(cwd).map((issue) => planItem(issue, closing, sessions.get(issue.number)));
}

/**
 * The open issues a MERGED PR already closes — the retire candidates. The work shipped, but the issue
 * never auto-closed (GitHub's auto-close takes only the FIRST of a `Closes #a, #b` list, so #b lingers).
 * What `vow reconcile` surfaces to bring the board back to 1:1 with reality. Pure.
 */
export function staleIssues(
  open: readonly GitHubIssue[],
  merged: readonly GitHubPr[],
): GitHubIssue[] {
  const closed = new Set(merged.flatMap((pr) => linkedIssues(pr.body)));
  return open.filter((issue) => issue.state === "open" && closed.has(issue.number));
}

/*
 * The write side: the agent acts on the plan. Writes throw on failure (unlike the reads, which
 * degrade to `[]`) — opening or moving an issue is an effect the caller must know succeeded.
 */

/** The default strand attribution for an agent-opened feature issue. */
const DEFAULT_STRAND = "generation · author layer";

/** The live plan board — vow's issues / Project ARE the plan, so a filed issue links back to it. */
const PLAN_BOARD = "https://github.com/users/vndredev/projects/3";

/**
 * The feature-template body (fills `.github/ISSUE_TEMPLATE/feature.md`'s sections), so an issue the agent
 * opens passes the template gate instead of tripping it. The element + why lead (the essence first); the
 * strand attribution + a link to the live plan board are a quiet footer. Pure.
 */
export function featureIssueBody(
  input: Readonly<{ element: string; strand?: string; why: string }>,
): string {
  const strand = input.strand ?? DEFAULT_STRAND;
  return [
    `**What**`,
    ``,
    input.element,
    ``,
    `**Why** — ${input.why}`,
    ``,
    `---`,
    `*Strand: ${strand} · [plan board](${PLAN_BOARD})*`,
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
export function createIssueOptions(input: Readonly<CreateIssueInput>): readonly string[] {
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

/** Reopen a closed issue via `gh` (-> `planned`/`doing`). Throws on failure. */
export function reopenIssue(cwd: string, issue: number): void {
  execFileSync("gh", ["issue", "reopen", String(issue)], { cwd, encoding: "utf8" });
}

/** Assign a user to an issue via `gh`. Throws on failure. */
export function assignIssue(cwd: string, issue: number, login: string): void {
  execFileSync("gh", ["issue", "edit", String(issue), "--add-assignee", login], {
    cwd,
    encoding: "utf8",
  });
}

/** Claim an issue for the agent by applying the `in-progress` label (-> the board reads `doing` from the
    moment develop starts). BEST-EFFORT: a gh/label hiccup must never fail the develop — the signal is
    advisory — so it returns whether it applied rather than throwing. */
export function claimIssue(cwd: string, issue: number): boolean {
  try {
    execFileSync("gh", ["issue", "edit", String(issue), "--add-label", IN_PROGRESS_LABEL], {
      cwd,
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}

/** Release an issue's `in-progress` label when the run ends — a merged PR (issue closed -> `done`) or an
    open PR (`Closes #N` -> `doing`) carries the status onward; a failed run drops back to `planned` instead
    of falsely lingering as `doing`. BEST-EFFORT, same as `claimIssue` — returns whether it removed it. */
export function releaseIssue(cwd: string, issue: number): boolean {
  try {
    execFileSync("gh", ["issue", "edit", String(issue), "--remove-label", IN_PROGRESS_LABEL], {
      cwd,
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}
