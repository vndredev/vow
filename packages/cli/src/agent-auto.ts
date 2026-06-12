/* oxlint-disable consistent-type-specifier-style -- one import; separate type imports trip no-duplicate-imports */
import {
  type AttemptCount,
  DEFAULT_ATTEMPT_CAP,
  DEFAULT_PROVIDER,
  type Provider,
  autoDecision,
  backlogWithinCap,
  mapLimit,
  providerFor,
} from "@vow/agent";
import {
  type Auth,
  DEFAULT_CONCURRENCY,
  actOnPrForHead,
  authArg,
  develop,
  flagValue,
} from "./agent-run.ts";
/* oxlint-enable consistent-type-specifier-style */
import { execFileSync } from "node:child_process";
import { prHeadOid } from "@vow/observability";
import { runAuditPass } from "./agent-audit.ts";

/** A terminal outcome — the loop stops on either; the rest (`develop`, `audit`) run another round. */
type TerminalOutcome = "done" | "exhausted";

/** One round's inputs that carry across iterations — the round counter and the per-issue attempt counts (so
 *  a repeatedly-failing issue is dropped from the backlog while healthy issues keep progressing). The counts
 *  are a readonly-array of `[issue, attempts]` pairs (the strict wall rejects a `ReadonlyMap` param). */
interface RoundState {
  readonly attempts: readonly AttemptCount[];
  readonly round: number;
}

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
 *  check makes gh exit 1 — that is the red CI the settle step then drafts, not a loop error). */
function watchChecks(pr: number, cwd: string): void {
  try {
    execFileSync("gh", ["pr", "checks", String(pr), "--watch"], { cwd, stdio: "inherit" });
  } catch {
    // A red check exits non-zero — settle reads the real CI state next and drafts it.
  }
}

/** Settle one open PR — update its branch, wait on CI, then merge green / draft red / report pending. The
 *  merge verdict is PINNED to the post-`updateBranch` head SHA: a rebase makes a new head commit + a fresh CI
 *  run, but `gh pr checks --watch` can return against the prior (green) run before the new one registers.
 *  Capturing the head after the rebase and requiring a completed run for THAT SHA makes a stale-green read
 *  read as pending — the loop waits rather than merging a branch whose rebased CI never ran. */
function settlePr(pr: number, cwd: string): number {
  updateBranch(pr, cwd);
  const head = prHeadOid(cwd, pr);
  watchChecks(pr, cwd);
  return actOnPrForHead(pr, cwd, head);
}

/** Settle every open PR in the round — each is merged green, drafted red, or left pending. */
function settleRound(cwd: string): void {
  for (const pr of openPrs(cwd)) {
    settlePr(pr, cwd);
  }
}

/** The message of a thrown value — an `Error`'s `.message`, else its string form. */
function reasonOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Develop the open issues that are not already in flight (no open PR) AND still within their per-issue
 *  attempt budget, each in its own worktree — capped at `DEFAULT_CONCURRENCY` lanes (the fan-out `run-all`
 *  uses). An issue dropped by `backlogWithinCap` has failed to produce a mergeable PR too many times; leaving
 *  it out keeps the rest of the loop progressing rather than re-attempting a permanently-stuck issue forever.
 *  Returns the issues it attempted (the caller folds them into the running attempt counts). Each worker is
 *  wrapped in try/catch (like `runAll`): a transient throw — a flaky `vp install`, a worktree collision —
 *  logs and CONTINUES, so one bad lane never rejects the `Promise.all` and tears down the whole spiral. */
async function developBacklog(
  args: AutoArgs,
  cwd: string,
  attempts: readonly AttemptCount[],
): Promise<readonly number[]> {
  const flight = inFlight(cwd);
  const open = openIssues(cwd).filter((issue) => !flight.has(issue));
  const backlog = backlogWithinCap(open, attempts, DEFAULT_ATTEMPT_CAP);
  await mapLimit(backlog, DEFAULT_CONCURRENCY, async (issue) => {
    try {
      await develop({ auth: args.auth, cwd, issue, json: false, provider: args.provider });
    } catch (error) {
      // A transient throw must fail only this lane, never reject the batch and crash the loop.
      // Settle + the next round then re-attempt the still-open issue naturally (until its attempt cap).
      process.stdout.write(
        `auto: issue #${issue} develop threw — continuing (${reasonOf(error)})\n`,
      );
    }
  });
  return backlog;
}

/** Fold the issues attempted this round into the running per-issue attempt counts — a fresh `[issue, count]`
 *  list (the prior count + 1 for each attempted issue), so the cap is enforced across rounds without a
 *  mutated shared structure. */
function bumpAttempts(
  attempts: readonly AttemptCount[],
  attempted: readonly number[],
): AttemptCount[] {
  const counts = new Map(attempts);
  for (const issue of attempted) {
    counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }
  return [...counts];
}

/** Run one round — develop the PR-less backlog (within the attempt cap), then settle every open PR; returns
 *  the next per-issue attempt counts (this round's attempts folded into the prior). */
async function autoRound(
  args: AutoArgs,
  cwd: string,
  state: Readonly<RoundState>,
): Promise<AttemptCount[]> {
  process.stdout.write(`auto: round ${state.round}/${args.maxRounds}\n`);
  const attempted = await developBacklog(args, cwd, state.attempts);
  settleRound(cwd);
  return bumpAttempts(state.attempts, attempted);
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
  let auditedClean = false;
  // Per-issue develop attempts across rounds — an issue at `DEFAULT_ATTEMPT_CAP` is dropped from the backlog.
  let state: RoundState = { attempts: [], round: 0 };
  for (;;) {
    const outcome = autoDecision({
      auditedClean,
      maxRounds: args.maxRounds,
      openIssues: openIssues(cwd).length,
      round: state.round,
    });
    if (outcome === "develop") {
      // A develop round changes the code — any prior clean audit is stale, so re-audit when it drains.
      auditedClean = false;
      const next = { attempts: state.attempts, round: state.round + 1 };
      // oxlint-disable-next-line no-await-in-loop -- a round depends on the prior's merges; rounds ARE sequential
      state = { attempts: await autoRound(args, cwd, next), round: next.round };
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
