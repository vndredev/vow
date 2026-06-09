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
  readonly milestone?: { readonly title: string; readonly dueOn?: string };
}

/** An open pull request, reduced to what links it back to its issues. */
export interface GitHubPr {
  readonly number: number;
  readonly title: string;
  readonly body: string;
}

interface RawIssue {
  number?: number;
  title?: string;
  state?: string;
  labels?: { name?: string }[];
  assignees?: { login?: string }[];
  milestone?: { title?: string; dueOn?: string | null } | null;
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
    number: typeof i.number === "number" ? i.number : 0,
    title: typeof i.title === "string" ? i.title : "",
    state: String(i.state ?? "").toLowerCase() === "closed" ? "closed" : "open",
    labels: (Array.isArray(i.labels) ? i.labels : [])
      .map((l) => l?.name ?? "")
      .filter((n) => n !== ""),
    assignees: (Array.isArray(i.assignees) ? i.assignees : [])
      .map((a) => a?.login ?? "")
      .filter((n) => n !== ""),
    ...(typeof i.milestone?.title === "string"
      ? {
          milestone: {
            title: i.milestone.title,
            ...(typeof i.milestone.dueOn === "string" ? { dueOn: i.milestone.dueOn } : {}),
          },
        }
      : {}),
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
        "number,title,state,labels,assignees,milestone",
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

// — the write side: the agent acts on the plan. Writes throw on failure (unlike the reads, which
//   degrade to `[]`) — opening or moving an issue is an effect the caller must know succeeded.

/** The feature-template body (fills `.github/ISSUE_TEMPLATE/feature.md`'s sections), so an issue the
    agent opens passes the template gate instead of tripping it. Pure. */
export function featureIssueBody(input: {
  readonly element: string;
  readonly why: string;
  readonly strand?: string;
}): string {
  const strand = input.strand ?? "generation · author layer";
  return [
    `**Strand / roadmap item** (${strand}) — see the [roadmap](../../docs/guide/changelog.md)`,
    ``,
    `**The element / function** — ${input.element}`,
    ``,
    `**Why** — ${input.why}`,
    ``,
  ].join("\n");
}

/** Open an issue via `gh` (title + body + labels + assignee + milestone) → its URL. Throws on failure. */
export function createIssue(
  cwd: string,
  input: {
    readonly title: string;
    readonly body: string;
    readonly labels?: readonly string[];
    readonly assignee?: string;
    readonly milestone?: string;
  },
): string {
  const args = ["issue", "create", "--title", input.title, "--body", input.body];
  if (input.labels !== undefined && input.labels.length > 0) {
    args.push("--label", input.labels.join(","));
  }
  if (input.assignee !== undefined) args.push("--assignee", input.assignee);
  if (input.milestone !== undefined) args.push("--milestone", input.milestone);
  return execFileSync("gh", args, { cwd, encoding: "utf8" }).trim();
}

/** Add an issue/PR (by URL) to a GitHub Project — resolves the Project's number + owner from its node
    id, then `gh project item-add`. Throws on failure. */
export function addToProject(cwd: string, projectId: string, url: string): void {
  const project = ghJson(
    cwd,
    `query{node(id:"${projectId}"){... on ProjectV2{number owner{... on User{login} ... on Organization{login}}}}}`,
  ).data.node as { number: number; owner: { login: string } };
  execFileSync(
    "gh",
    ["project", "item-add", String(project.number), "--owner", project.owner.login, "--url", url],
    { cwd, encoding: "utf8" },
  );
}

/** Close an issue via `gh` (→ `done`). Throws on failure. */
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

// — the Project sync: the studio's derived status is the truth; write it onto the GitHub Project's
//   Status field so its board/views match 1:1 (catching the drift the Project's own workflows miss).

/** The GitHub Project Status option for a derived status (planned → Todo, doing → In Progress, done →
    Done). Pure. */
export function statusOption(status: IssueStatus): string {
  return status === "done" ? "Done" : status === "doing" ? "In Progress" : "Todo";
}

/** One item whose Project Status was corrected to match the studio. */
export interface StatusChange {
  readonly number: number;
  readonly from: string;
  readonly to: string;
}

/** What a project sync changed: the corrected items + how many already matched. */
export interface SyncResult {
  readonly changed: readonly StatusChange[];
  readonly matched: number;
}

function ghJson(cwd: string, query: string): { data: Record<string, unknown> } {
  return JSON.parse(
    execFileSync("gh", ["api", "graphql", "-f", `query=${query}`], { cwd, encoding: "utf8" }),
  ) as { data: Record<string, unknown> };
}

interface StatusField {
  readonly id: string;
  readonly options: readonly { readonly id: string; readonly name: string }[];
}
interface ProjectItem {
  readonly id: string;
  readonly content?: { readonly number?: number };
  readonly fieldValueByName?: { readonly name?: string };
}

/**
 * Sync a GitHub Project's Status field to the studio's derived issue status (the studio is the source of
 * truth). For every issue on the plan, set its Project Status to match `deriveIssueStatus` — planned →
 * Todo, doing → In Progress, done → Done — and report what changed. Throws on a `gh` failure.
 */
export function syncProjectStatus(cwd: string, projectId: string): SyncResult {
  const field = (
    ghJson(
      cwd,
      `query{node(id:"${projectId}"){... on ProjectV2{field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}}}}`,
    ).data.node as { field: StatusField }
  ).field;
  const optionId = (name: string): string => {
    const o = field.options.find((opt) => opt.name === name);
    if (o === undefined) throw new Error(`the Project has no Status option "${name}"`);
    return o.id;
  };
  const items = (
    ghJson(
      cwd,
      `query{node(id:"${projectId}"){... on ProjectV2{items(first:100){nodes{id content{... on Issue{number}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}`,
    ).data.node as { items: { nodes: ProjectItem[] } }
  ).items.nodes;
  const byNumber = new Map<number, { id: string; status?: string }>();
  for (const it of items) {
    if (it.content?.number !== undefined) {
      byNumber.set(it.content.number, { id: it.id, status: it.fieldValueByName?.name });
    }
  }
  const changed: StatusChange[] = [];
  let matched = 0;
  for (const p of issuePlan(cwd)) {
    const item = byNumber.get(p.issue.number);
    if (item === undefined) continue;
    const want = statusOption(p.status);
    if (item.status === want) {
      matched++;
      continue;
    }
    ghJson(
      cwd,
      `mutation{updateProjectV2ItemFieldValue(input:{projectId:"${projectId}",itemId:"${item.id}",fieldId:"${field.id}",value:{singleSelectOptionId:"${optionId(want)}"}}){projectV2Item{id}}}`,
    );
    changed.push({ number: p.issue.number, from: item.status ?? "(unset)", to: want });
  }
  return { changed, matched };
}
