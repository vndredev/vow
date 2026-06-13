import type { GitHubIssue, Maybe, Milestone } from "./types.ts";
import { NONE } from "./none.ts";
import { execFileSync } from "node:child_process";
import process from "node:process";

/**
 * The phase resolution — vow's anti-drift answer to "every issue must carry a phase". A phase is a
 * milestone on the roadmap timeline; the CURRENT phase is the open milestone with the latest due date
 * (the newest band on the timeline). `add_issue` + `auditIssue` default to it, so no issue is ever filed
 * phase-less while a phase exists; `phaselessIssues` is the detector that surfaces any that slipped
 * through. All the decision logic is pure — only the `gh` fetch touches the world.
 */

/** A non-null object — the guard to walk an untrusted `gh api` payload without an unsafe cast. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A present, non-empty string field off a record — `NONE` when absent or not a string. */
function strField(record: Readonly<Record<string, unknown>>, key: string): Maybe<string> {
  const value = record[key];
  if (typeof value === "string" && value !== "") {
    return value;
  }
  return NONE;
}

/** The raw array from a `gh api milestones` JSON payload, or `[]` when malformed / not an array. */
function rawMilestones(json: string): readonly unknown[] {
  try {
    const raw: unknown = JSON.parse(json);
    if (Array.isArray(raw)) {
      return raw;
    }
  } catch {
    return [];
  }
  return [];
}

/** Parse the `gh api` milestones JSON (`[{title, dueOn}]`) into `Milestone`s, skipping any titleless
    element and dropping a missing `dueOn`. Pure; `[]` on malformed input. */
export function parseMilestones(json: string): Milestone[] {
  const out: Milestone[] = [];
  for (const item of rawMilestones(json)) {
    if (isRecord(item)) {
      const title = strField(item, "title");
      if (typeof title === "string") {
        const dueOn = strField(item, "dueOn");
        if (typeof dueOn === "string") {
          out.push({ dueOn, title });
        } else {
          out.push({ title });
        }
      }
    }
  }
  return out;
}

/** The `VOW_PHASE` override — pin the current phase explicitly (like `VOW_PROJECT_ID`), else `NONE`. */
function envPhase(): Maybe<string> {
  const env = process.env["VOW_PHASE"];
  if (typeof env === "string" && env !== "") {
    return env;
  }
  return NONE;
}

/** The current phase: the `override` when set, else the milestone with the latest `dueOn` (the newest band
    on the roadmap timeline — what new work joins). Pure; `NONE` when no dated milestone exists. */
export function currentPhase(
  milestones: readonly Milestone[],
  override: Maybe<string>,
): Maybe<string> {
  if (typeof override === "string" && override !== "") {
    return override;
  }
  let latest: Maybe<Milestone> = NONE;
  for (const milestone of milestones) {
    const due = milestone.dueOn;
    if (typeof due === "string" && (typeof latest !== "object" || due > (latest.dueOn ?? ""))) {
      latest = milestone;
    }
  }
  return latest?.title;
}

/** The open milestones via `gh api`. Returns `[]` (never throws) when `gh`/auth/network is absent. */
export function listMilestones(cwd: string): Milestone[] {
  try {
    const out = execFileSync(
      "gh",
      [
        "api",
        "repos/{owner}/{repo}/milestones",
        "-X",
        "GET",
        "-f",
        "state=open",
        "-f",
        "per_page=100",
        "--jq",
        "[.[] | {title: .title, dueOn: .due_on}]",
      ],
      { cwd, encoding: "utf8" },
    );
    return parseMilestones(out);
  } catch {
    return [];
  }
}

/** Resolve the current phase against the live repo — the `VOW_PHASE` override, else the latest-due open
    milestone. `NONE` when no phase exists (a milestone-less repo: the gate is then a no-op). */
export function resolveCurrentPhase(cwd: string): Maybe<string> {
  return currentPhase(listMilestones(cwd), envPhase());
}

/** The milestone a new issue takes — the caller's explicit one, else the resolved current phase, so no
    issue is filed phase-less while a phase exists. Pure (the resolution is passed in). */
export function milestoneFor(given: Maybe<string>, fallback: Maybe<string>): Maybe<string> {
  if (typeof given === "string" && given !== "") {
    return given;
  }
  return fallback;
}

/** The OPEN issues carrying no milestone — the phase-less drift the plan must not hold. The detector
    `vow reconcile` surfaces and the gate's red path. Pure. */
export function phaselessIssues(issues: readonly GitHubIssue[]): GitHubIssue[] {
  return issues.filter((issue) => issue.state === "open" && typeof issue.milestone !== "object");
}
