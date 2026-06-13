/**
 * The shared type vocabulary of @vow/observability — the absence type and the Badge variant. Kept
 * dependency-free so both the git side (`index.ts`) and the GitHub side (`github.ts`/`project.ts`)
 * can import it without forming an import cycle. The absence value itself lives in `none.ts`.
 */

/** A value that may be absent. The max lint wall forbids naming `undefined`, comparing to it, and
    `typeof x === "undefined"` all at once — so absence is read through positive `typeof` type guards
    and minted only via `NONE` (see `none.ts`). */
export type Maybe<T> = T | undefined;

/** A Badge variant — vow's status colours, sourced from @vow/theme (the one variant vocabulary). */
export type { BadgeVariant } from "@vow/theme";

/** An issue's derived plan status — the board's three columns. */
export type IssueStatus = "planned" | "doing" | "done";

/** A milestone reduced to what the plan needs. */
export interface Milestone {
  readonly dueOn?: string;
  readonly title: string;
}

/** A GitHub issue, reduced to what the plan needs. */
export interface GitHubIssue {
  readonly assignees: readonly string[];
  readonly labels: readonly string[];
  readonly milestone?: Milestone;
  readonly number: number;
  readonly state: "open" | "closed";
  readonly title: string;
}

/** One issue's developable detail — number, title, and the body (the spec the plan inlines). */
export interface IssueDetail {
  readonly body: string;
  readonly number: number;
  readonly title: string;
}

/** An open pull request, reduced to what links it back to its issues + the URL the human watches it at.
    `isDraft` tells a ready PR (the live develop -> merge arc) from a stalled draft (a red develop run parked
    for a human) — only a ready PR marks its issue `doing`, so a draft never pins it "In Progress" forever. */
export interface GitHubPr {
  readonly body: string;
  readonly isDraft: boolean;
  readonly number: number;
  readonly title: string;
  readonly url: string;
}

/** The agent's session link for an issue — the open PR that closes it, where the run is watched. */
export interface AgentSession {
  readonly number: number;
  readonly url: string;
}

/** One issue on the plan, with its derived status + (when `doing`) the agent session that's redeeming it. */
export interface PlanItem {
  readonly issue: GitHubIssue;
  readonly session?: AgentSession;
  readonly status: IssueStatus;
}

/** One item whose Project Status was corrected to match the studio. */
export interface StatusChange {
  readonly from: string;
  readonly number: number;
  readonly to: string;
}

/** What a project sync changed: the corrected items + how many already matched. */
export interface SyncResult {
  readonly changed: readonly StatusChange[];
  readonly matched: number;
}
