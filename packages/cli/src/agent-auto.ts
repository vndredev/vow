import { DEFAULT_CONCURRENCY, actOnPr, authArg, develop, flagValue } from "./agent-run.ts";
import { DEFAULT_PROVIDER, autoDecision, mapLimit, providerFor } from "@vow/agent";
// oxlint-disable-next-line no-duplicate-imports -- the agent-run value import above; Auth needs a top-level type import
import type { Auth } from "./agent-run.ts";
// oxlint-disable-next-line no-duplicate-imports -- the @vow/agent value import above; Provider needs a top-level type import
import type { Provider } from "@vow/agent";
import { execFileSync } from "node:child_process";
import { runAuditPass } from "./agent-audit.ts";

/** A terminal outcome — the loop stops on either; the rest (`develop`, `audit`) run another round. */
type TerminalOutcome = "done" | "exhausted";

/**
 * `vow agent auto` — the self-heal SPIRAL. Each round develops the PR-less open issues, then settles the
 * open PRs (update their branch, wait on CI, merge green / draft red). When the backlog empties, it AUDITS
 * the codebase (read-only, every dimension) and files what it finds as new issues — generating its own next
 * work — until a full audit pass comes back clean (`done`) or the safety round cap is hit (`exhausted`).
 * The pure decision is `autoDecision` in @vow/agent; this file is its gh-shelling wrapper. It imports the
 * shared run + merge primitives from `agent-run.ts` + the audit pass from `agent-audit.ts` (no import cycle).
 */

/** The default safety cap on rounds — without an empty backlog the loop still powers down after this many. */
export const DEFAULT_MAX_ROUNDS = 10;

/** A whitespace-separated list of positive integers from gh's `--jq` output -> the numbers (newline split). */
function numbersOf(out: string): number[] {
  const nums: number[] = [];
  for (const line of out.split("\n")) {
    const num = Number(line.trim());
    if (Number.isInteger(num) && num > 0) {
      nums.push(num);
    }
  }
  return nums;
}

/** A validated `vow agent auto` invocation — the round cap, the resolved provider, and the auth choice. */
interface AutoArgs {
  readonly auth: Auth;
  readonly maxRounds: number;
  readonly provider: Provider;
}

/** The round cap from `--max-rounds <n>` — a positive integer, else the default safety cap. */
export function maxRoundsOf(rest: readonly string[]): number {
  const raw = Number(flagValue(rest, "--max-rounds"));
  if (Number.isInteger(raw) && raw > 0) {
    return raw;
  }
  return DEFAULT_MAX_ROUNDS;
}

/** Parse + validate `auto` args (round cap + provider + auth), or a usage/error string. */
function parseAuto(rest: readonly string[]): AutoArgs | string {
  const provider = providerFor(flagValue(rest, "--provider") || DEFAULT_PROVIDER);
  if (!provider) {
    return "vow agent auto: unknown provider";
  }
  return { auth: authArg(rest), maxRounds: maxRoundsOf(rest), provider };
}

/** The open issue numbers via `gh issue list --json number --jq .[].number` (no double quotes in the jq). */
function openIssues(cwd: string): number[] {
  const out = execFileSync(
    "gh",
    ["issue", "list", "--state", "open", "--json", "number", "--jq", ".[].number"],
    { cwd, encoding: "utf8" },
  );
  return numbersOf(out);
}

/** The open PR numbers via `gh pr list --json number --jq .[].number`. */
function openPrs(cwd: string): number[] {
  const out = execFileSync(
    "gh",
    ["pr", "list", "--state", "open", "--json", "number", "--jq", ".[].number"],
    { cwd, encoding: "utf8" },
  );
  return numbersOf(out);
}

/** An issue-N branch name (`feat/issue-231`) -> the issue number it develops; the auto-loop uses it to skip
 *  issues already in flight (an open PR exists), so a round never double-develops the same issue. */
const ISSUE_BRANCH = /issue-(\d+)/u;

/** The issue numbers already in flight — parsed from the open PRs' branch names via the issue-N regex. */
function inFlight(cwd: string): Set<number> {
  const out = execFileSync(
    "gh",
    ["pr", "list", "--state", "open", "--json", "headRefName", "--jq", ".[].headRefName"],
    { cwd, encoding: "utf8" },
  );
  const issues = new Set<number>();
  for (const branch of out.split("\n")) {
    const match = ISSUE_BRANCH.exec(branch.trim());
    if (match) {
      issues.add(Number(match[1]));
    }
  }
  return issues;
}

/** Update PR `pr`'s branch from the base (so CI runs against the latest main), tolerating an already-current
 *  branch (gh exits non-zero when there is nothing to update — not an error for the loop). */
function updateBranch(pr: number, cwd: string): void {
  try {
    execFileSync("gh", ["pr", "update-branch", String(pr)], { cwd, stdio: "inherit" });
  } catch {
    // Already up to date (or no permission) — fall through to the CI wait + act.
  }
}

/** Block until PR `pr`'s checks finish via `gh pr checks --watch`, tolerating a non-zero exit (a failing
 *  check makes gh exit 1 — that is the red CI `actOnPr` then drafts, not a loop error). */
function watchChecks(pr: number, cwd: string): void {
  try {
    execFileSync("gh", ["pr", "checks", String(pr), "--watch"], { cwd, stdio: "inherit" });
  } catch {
    // A red check exits non-zero — settle reads the real CI state next and drafts it.
  }
}

/** Settle one open PR — update its branch, wait on CI, then merge green / draft red / report pending. */
function settlePr(pr: number, cwd: string): number {
  updateBranch(pr, cwd);
  watchChecks(pr, cwd);
  return actOnPr(pr, cwd);
}

/** Settle every open PR in the round — each is merged green, drafted red, or left pending. */
function settleRound(cwd: string): void {
  for (const pr of openPrs(cwd)) {
    settlePr(pr, cwd);
  }
}

/** Develop the open issues that are not already in flight (no open PR), each in its own worktree — capped at
 *  `DEFAULT_CONCURRENCY` lanes so one machine isn't swamped (the same fan-out `run-all` uses). */
async function developBacklog(args: AutoArgs, cwd: string): Promise<void> {
  const flight = inFlight(cwd);
  const backlog = openIssues(cwd).filter((issue) => !flight.has(issue));
  await mapLimit(backlog, DEFAULT_CONCURRENCY, async (issue) => {
    await develop({ auth: args.auth, cwd, issue, json: false, provider: args.provider });
  });
}

/** Run one round — develop the PR-less backlog, then settle every open PR. */
async function autoRound(args: AutoArgs, cwd: string, round: number): Promise<void> {
  process.stdout.write(`auto: round ${round}/${args.maxRounds}\n`);
  await developBacklog(args, cwd);
  settleRound(cwd);
}

/** The exit + banner for a terminal outcome — 0 when the codebase is findings-free (`done`), 1 when the cap
 *  was hit. */
function reportOutcome(outcome: TerminalOutcome): number {
  if (outcome === "done") {
    process.stdout.write("auto: findings-free — powering down (done)\n");
    return 0;
  }
  process.stdout.write("auto: round cap hit — stopping (exhausted)\n");
  return 1;
}

/** The auto-heal SPIRAL — until `autoDecision` says stop, either develop a round or, on an empty backlog,
 *  audit for new work; exit 0 when a full audit pass is clean (`done`), else 1 (the safety cap was hit). The
 *  decision is the pure `autoDecision`; this shells gh + runs the round or the audit pass. `auditedClean`
 *  carries a clean (zero-finding) audit into the next decision, so the loop powers down once findings-free. */
async function loop(args: AutoArgs, cwd: string): Promise<number> {
  let round = 0;
  let auditedClean = false;
  for (;;) {
    const outcome = autoDecision({
      auditedClean,
      maxRounds: args.maxRounds,
      openIssues: openIssues(cwd).length,
      round,
    });
    if (outcome === "develop") {
      round += 1;
      // A develop round changes the code — any prior clean audit is stale, so re-audit when it drains.
      auditedClean = false;
      // oxlint-disable-next-line no-await-in-loop -- a round depends on the prior's merges; rounds ARE sequential
      await autoRound(args, cwd, round);
    } else if (outcome === "audit") {
      // A clean pass (zero filed) marks the codebase findings-free for the next decision -> `done`.
      auditedClean = runAuditPass(args.auth, cwd) === 0;
    } else {
      return reportOutcome(outcome);
    }
  }
}

/** `vow agent auto [--provider <name>] [--auth subscription|api] [--max-rounds <n>]` — the self-heal SPIRAL:
 *  develop the backlog + settle the PRs each round; when it empties, audit the codebase + file findings as
 *  new work; loop until a full audit pass is findings-free (done) or the round cap (exhausted). */
export function runAuto(rest: readonly string[]): number | Promise<number> {
  const args = parseAuto(rest);
  if (typeof args === "string") {
    process.stderr.write(`${args}\n`);
    return 1;
  }
  return loop(args, process.cwd());
}
