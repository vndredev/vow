/* oxlint-disable consistent-type-specifier-style -- one import; separate type imports trip no-duplicate-imports */
import {
  type AttemptCount,
  type AutoOutcome,
  DEFAULT_ATTEMPT_CAP,
  DEFAULT_PROVIDER,
  type IssueArea,
  type Provider,
  areaOf,
  autoDecision,
  backlogOverCap,
  backlogWithinCap,
  mapLimit,
  partitionByArea,
  providerFor,
} from "@vow/agent";
import {
  type Auth,
  DEFAULT_CONCURRENCY,
  actOnPrForHead,
  authArg,
  develop,
  errorReason,
  flagValue,
} from "./agent-run.ts";
import { type LoopStatus, prHeadOid, writeLoopStatus } from "@vow/observability";
/* oxlint-enable consistent-type-specifier-style */
import { claimIssues, planBacklog } from "./plan-ops.ts";
import { headSha, resolveHeadChanged, runAuditPass, writeCleanAuditSha } from "./agent-audit.ts";
import { cleanStaleWorktrees } from "./agent-worktrees.ts";
import { execFileSync } from "node:child_process";

/** A terminal outcome — the loop stops on any of these; the rest (`develop`, `audit`) run another round.
 *  `audit-broken` is NOT an `autoDecision` outcome: it is raised by running the audit (a dimension's
 *  shell-out threw or returned a non-array) — a broken pass must stop the loop loudly, never read as clean. */
type TerminalOutcome = "audit-broken" | "done" | "exhausted" | "stalled";

/** One round's inputs that carry across iterations — the round counter and the per-issue attempt counts (so
 *  a repeatedly-failing issue is dropped from the backlog while healthy issues keep progressing). The counts
 *  are a readonly-array of `[issue, attempts]` pairs (the strict wall rejects a `ReadonlyMap` param). */
export interface RoundState {
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
  return out
    .split("\n")
    .map((line) => Number(line.trim()))
    .filter((num) => Number.isInteger(num) && num > 0);
}

/** A validated `vow agent auto` invocation — the round cap, the resolved provider, and the auth choice. */
export interface AutoArgs {
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

/** The jq for the batched area read — one TAB-separated line per open issue: `<number>` then each label name
 *  (`[(.number|tostring)] + [.labels[].name] | join("\t")`). A tab can't appear in a GitHub label name, so the
 *  first field is always the number and the rest are clean label names. `String.raw` keeps the `\t` literal. */
const AREA_JQ = String.raw`.[] | [(.number|tostring)] + [.labels[].name] | join("\t")`;

/** The open issues' areas in ONE `gh issue list` call (#681) — `--json number,labels` + `AREA_JQ`, so the
 *  per-round partition resolves every issue's `area:` label without a `gh issue view` apiece. Each line splits
 *  on TAB into the number + its label names; `areaOf` then picks the `area:` label (or "" when none). */
function openIssueAreas(cwd: string): IssueArea[] {
  const out = execFileSync(
    "gh",
    ["issue", "list", "--state", "open", "--json", "number,labels", "--jq", AREA_JQ],
    { cwd, encoding: "utf8" },
  );
  const areas: IssueArea[] = [];
  for (const line of out.split("\n")) {
    const [num = "", ...labels] = line.split("\t");
    const issue = Number(num);
    if (Number.isInteger(issue) && issue > 0) {
      areas.push([issue, areaOf(labels)]);
    }
  }
  return areas;
}

/** Partition the within-cap backlog to at most ONE issue per `area:` label (#681) — so the round's concurrent
 *  develops touch DISJOINT files and the per-PR settle merges them instead of fleet-CONFLICTING into drafts.
 *  Resolves each within-cap issue's area from the batched `openIssueAreas` map (an issue absent there — a
 *  race — falls to "", kept), preserves the backlog order, and hands the pairs to the pure `partitionByArea`.
 *  The rest wait for the next round, developed once their area is free. */
function partitionBacklog(within: readonly number[], cwd: string): number[] {
  const byIssue = new Map(openIssueAreas(cwd));
  const pairs: IssueArea[] = within.map((issue) => [issue, byIssue.get(issue) ?? ""]);
  return partitionByArea(pairs);
}

/** The open, NON-DRAFT PR numbers via `gh pr list` — `--json number,isDraft` then a `--jq` filter that drops
 *  drafts (`select(.isDraft|not)`). A draft is a PR the loop drafted off a red run (or a local-gate failure),
 *  i.e. "surfaced for a human" by design — the settle sweep skips it (never re-deciding merge off CI alone),
 *  and the decision counts only settleable PRs (a lone stuck draft must not read as progress). */
function settleablePrs(cwd: string): number[] {
  const out = execFileSync(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "open",
      "--json",
      "number,isDraft",
      "--jq",
      ".[] | select(.isDraft|not) | .number",
    ],
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

/** Prune the prior run's leftover worktrees on `vow serve --watch` startup (#681) — without this a restart
 *  hits "branch feat/issue-N already used by worktree" on a leftover `.vow-worktrees/feat-issue-N` and can't
 *  reuse the branch. An issue with an OPEN PR is treated as active (its worktree may be live / wanted) and
 *  SPARED; every other leftover per-issue worktree is removed. Best-effort + reported, never throws — a
 *  cleanup hiccup must not block the hub coming up. Reads the in-flight set from gh, so a transient gh failure
 *  is caught and logged rather than crashing startup. */
export function pruneStaleWorktreesOnStartup(cwd: string): void {
  try {
    const removed = cleanStaleWorktrees(cwd, [...inFlight(cwd)]);
    if (removed > 0) {
      process.stdout.write(
        `vow serve: pruned ${removed} stale agent worktree(s) from a prior run\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`vow serve: stale-worktree cleanup skipped: ${errorReason(error)}\n`);
  }
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

/** Settle ONE settleable PR best-effort — `settlePr` (update branch → wait CI → merge green / draft red),
 *  wrapped in try/catch (mirroring the develop-lane isolation #412 gave the develop half): a `gh pr merge`
 *  that refuses an unmergeable PR — a fleet-overlap conflict, or `gh pr ready --undo` on an already-draft PR —
 *  exits 1 and THROWS; isolating it per-PR logs + continues, so one un-settleable PR never aborts the whole
 *  spiral (which would deterministically re-abort on restart). Yields to the event loop first, so a settle
 *  sweep launched alongside the round's develops interleaves with them rather than blocking the whole tick. */
async function settleOne(pr: number, cwd: string): Promise<void> {
  await Promise.resolve();
  try {
    settlePr(pr, cwd);
  } catch (error) {
    // A gh-exit-1 throw (not mergeable / already a draft / a permission hiccup) must fail only this PR.
    // The next round re-reads + re-settles it; a persistently-stuck PR stays surfaced, never crashing.
    process.stdout.write(`auto: pr #${pr} settle threw — continuing (${errorReason(error)})\n`);
  }
}

/** Settle every settleable (open, non-draft) PR — each merged green, drafted red, or left pending. DECOUPLED
 *  from the round barrier (#676): this runs CONCURRENTLY with the round's develops (see `autoRound`), so a PR
 *  that is already green (a prior round's converged work) settles + merges in minutes, never waiting on the
 *  slowest sibling's fix-round to finish the whole round first. Each PR is settled independently + best-effort
 *  (`settleOne`), so one un-settleable PR never aborts the sweep. The settleable set is re-read here (not the
 *  round-start snapshot), so a PR that greened since the round began is picked up the same tick. */
async function settleRound(cwd: string): Promise<void> {
  await mapLimit(settleablePrs(cwd), DEFAULT_CONCURRENCY, async (pr) => {
    await settleOne(pr, cwd);
  });
}

/** The round's EFFECTIVE workload, computed once per iteration so the decision and the develop step agree:
 *  `within` is the PR-less, within-cap backlog the round will actually develop, `dropped` the still-open
 *  issues the attempt cap excluded (stuck, surfaced for a human), and `settleable` the open non-draft PRs the
 *  settle sweep can still merge. Feeding the decision THESE (not the raw open count) is what stops a
 *  cap-dropped issue from making every remaining round a guaranteed no-op. */
interface Effective {
  readonly dropped: readonly number[];
  readonly settleable: readonly number[];
  readonly within: readonly number[];
}

/** The round's effective workload (within-cap backlog · cap-dropped issues · settleable PRs) from the live
 *  gh state + the running attempt counts. The backlog excludes issues already in flight (an open PR exists),
 *  so a round never double-develops; the cap split is over the not-in-flight open set. The within-cap backlog
 *  is then PARTITIONED to at most one issue per `area:` label (#681), so the round's concurrent develops touch
 *  disjoint files — same-area siblings wait for the next round, developed once their area is free, instead of
 *  fleet-conflicting on the per-PR rebase and drafting. */
function effectiveBacklog(cwd: string, attempts: readonly AttemptCount[]): Effective {
  const flight = inFlight(cwd);
  const open = planBacklog(cwd, [...flight]).filter((issue) => !flight.has(issue));
  const within = backlogWithinCap(open, attempts, DEFAULT_ATTEMPT_CAP);
  return {
    dropped: backlogOverCap(open, attempts, DEFAULT_ATTEMPT_CAP),
    settleable: settleablePrs(cwd),
    within: partitionBacklog(within, cwd),
  };
}

/** The spiral's invariants across every round — the validated args + the repo cwd. Bundled so the round /
 *  decision helpers take ONE context (the strict wall caps params at 3). */
export interface Spiral {
  readonly args: AutoArgs;
  readonly cwd: string;
}

/** Develop the `backlog` issues (already filtered to PR-less + within-cap), each in its own worktree — capped
 *  at `DEFAULT_CONCURRENCY` lanes (the fan-out `run-all` uses). Each worker is wrapped in try/catch (like
 *  `runAll`): a transient throw — a flaky `vp install`, a worktree collision — logs and CONTINUES, so one bad
 *  lane never rejects the `Promise.all` and tears down the whole spiral. */
async function developBacklog(spiral: Spiral, backlog: readonly number[]): Promise<void> {
  const { args, cwd } = spiral;
  claimIssues(cwd, backlog);
  await mapLimit(backlog, DEFAULT_CONCURRENCY, async (issue) => {
    try {
      await develop({ auth: args.auth, cwd, issue, json: false, provider: args.provider });
    } catch (error) {
      // A transient throw must fail only this lane, never reject the batch and crash the loop.
      // Settle + the next round then re-attempt the still-open issue naturally (until its attempt cap).
      process.stdout.write(
        `auto: issue #${issue} develop threw — continuing (${errorReason(error)})\n`,
      );
    }
  });
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

/** The LIVE status payload for an advancing round (#673) — the advancing round number, the within-cap backlog
 *  the round is developing, the open settleable-PR count right now, a fresh `lastRound` timestamp, and
 *  `running: true`. Pure (the counts are passed in), so the per-advance status is unit-testable without gh —
 *  the round number + live counts the cockpit reads while the loop works, not a frozen idle snapshot. */
export function advanceStatus(round: Readonly<RoundState>, counts: RoundCounts): LoopStatus {
  return {
    backlog: counts.backlog,
    lastRound: new Date().toISOString(),
    openPrs: counts.openPrs,
    round: round.round,
    running: true,
  };
}

/** The live counts an advancing round records — the within-cap backlog it is developing + the open
 *  settleable-PR count read right now. Bundled so `advanceStatus` stays within the param cap. */
export interface RoundCounts {
  readonly backlog: number;
  readonly openPrs: number;
}

/** The side-effecting operations one round drives — develop the backlog (each issue in its own worktree),
 *  settle the open green PRs (concurrently, decoupled from the develop), read the live settleable-PR count
 *  (for the per-advance status), and write the live status. Injectable so the round's concurrency + the
 *  per-advance status writes are tested without shelling gh; `realRoundOps` is the live gh-backed default. */
export interface RoundOps {
  readonly developBacklog: (backlog: readonly number[]) => Promise<void>;
  readonly settle: () => Promise<void>;
  readonly settleableCount: () => number;
  readonly writeStatus: (status: Readonly<LoopStatus>) => void;
}

/** The live gh-backed round operations for `spiral` — develop via the worktree loop, settle the open PRs, read
 *  the live settleable-PR count, and record the status to `.vow/loop-status.json`. What `autoRound` runs
 *  against; a test injects fakes to assert the concurrency + the per-advance status writes. */
function realRoundOps(spiral: Spiral): RoundOps {
  return {
    developBacklog: async (backlog) => {
      await developBacklog(spiral, backlog);
    },
    settle: async () => {
      await settleRound(spiral.cwd);
    },
    settleableCount: () => settleablePrs(spiral.cwd).length,
    writeStatus: (status) => {
      writeLoopStatus(spiral.cwd, status);
    },
  };
}

/** Record the loop's LIVE status as the round advances (#673) — the advancing round number + the live counts
 *  (the within-cap backlog + the open settleable PRs read NOW), with a fresh timestamp, so the cockpit tracks
 *  the round being WORKED, not a frozen snapshot. Best-effort (`writeStatus` never throws). */
function recordAdvance(
  ops: RoundOps,
  state: Readonly<RoundState>,
  backlog: readonly number[],
): void {
  ops.writeStatus(
    advanceStatus(state, { backlog: backlog.length, openPrs: ops.settleableCount() }),
  );
}

/** Orchestrate one round against `ops` (#676 / #673) — record the LIVE status as the round ADVANCES (the
 *  advancing round number + live counts), develop the within-cap backlog AND settle the open green PRs
 *  CONCURRENTLY (the settle no longer waits for the whole round's develop, so already-green work merges in
 *  minutes instead of blocking behind the slowest sibling's fix-round), then record the advance again with the
 *  fresh open-PR count. Both halves are independently isolated, so neither aborts the other. Exported with the
 *  `ops` seam so a test asserts the concurrency + the per-advance writes without shelling gh. */
export async function orchestrateRound(
  ops: RoundOps,
  state: Readonly<RoundState>,
  backlog: readonly number[],
): Promise<void> {
  recordAdvance(ops, state, backlog);
  await Promise.all([ops.developBacklog(backlog), ops.settle()]);
  recordAdvance(ops, state, backlog);
}

/** Run one round — orchestrate the develop + concurrent settle against the live gh-backed ops, then fold this
 *  round's attempts into the running per-issue counts. The decoupled settle + the per-advance status writes
 *  live in `orchestrateRound` (testable); this is the live wrapper. */
export async function autoRound(
  spiral: Spiral,
  state: Readonly<RoundState>,
  backlog: readonly number[],
): Promise<AttemptCount[]> {
  process.stdout.write(`auto: round ${state.round}/${spiral.args.maxRounds}\n`);
  await orchestrateRound(realRoundOps(spiral), state, backlog);
  return bumpAttempts(state.attempts, backlog);
}

/** The `#231, #232` tag list of the cap-dropped issue numbers, for the stalled banner. */
function tagList(issues: readonly number[]): string {
  return issues.map((issue) => `#${issue}`).join(", ");
}

/** The banner for each terminal outcome — `stalled` names the cap-dropped issues a human must unstick (the
 *  effective backlog is empty only because they hit the attempt cap, and no PR remains to settle), and
 *  `audit-broken` stops loudly (a dimension's shell-out failed — the pass checked nothing, never read it
 *  clean). The map keeps `reportOutcome` a single write + exit. */
function outcomeBanner(outcome: TerminalOutcome, dropped: readonly number[]): string {
  const banners: Readonly<Record<TerminalOutcome, string>> = {
    "audit-broken":
      "auto: audit broke (a dimension failed to run) — stopping; checked nothing, NOT findings-free",
    done: "auto: findings-free — powering down (done)",
    exhausted: "auto: round cap hit — stopping (exhausted)",
    stalled: `auto: stalled — every remaining issue hit the attempt cap (${tagList(dropped)}); a human must unstick them`,
  };
  return banners[outcome];
}

/** The exit + banner for a terminal outcome — 0 when the codebase is findings-free (`done`), else 1 (the
 *  round cap `exhausted`, a cap-stuck `stalled`, or a broken `audit-broken`). */
function reportOutcome(outcome: TerminalOutcome, dropped: readonly number[]): number {
  process.stdout.write(`${outcomeBanner(outcome, dropped)}\n`);
  if (outcome === "done") {
    return 0;
  }
  return 1;
}

/** One iteration's mutable carry — the attempt/round counter `state` and the EFFECTIVE workload `effective`
 *  computed for it (so the decision + the develop step read the SAME backlog). Bundled so `runDecision` stays
 *  within the param cap. */
interface Round {
  readonly effective: Effective;
  readonly state: RoundState;
}

/** What running the chosen action yields — either ADVANCE to the next round (the new state + whether the
 *  codebase is now audited-clean), or a TERMINAL outcome the audit raised (`audit-broken`). Modelled as a
 *  discriminated result so a broken audit can stop the loop without an in-band sentinel. */
type Advance =
  | { readonly auditedClean: boolean; readonly kind: "advance"; readonly state: RoundState }
  | { readonly kind: "terminal"; readonly outcome: TerminalOutcome };

/** Run the action `autoDecision` chose — `develop` advances a round (the precomputed backlog), `audit` runs a
 *  full pass. A clean pass (zero filed, nothing broke) marks the codebase findings-free for the next decision
 *  -> `done`; a BROKEN pass (a dimension's shell-out failed) raises the `audit-broken` terminal so the loop
 *  stops loudly rather than spinning forever or declaring success having audited nothing. */
async function runDecision(
  spiral: Spiral,
  outcome: "audit" | "develop",
  round: Readonly<Round>,
): Promise<Advance> {
  const { effective, state } = round;
  if (outcome === "develop") {
    const next = { attempts: state.attempts, round: state.round + 1 };
    return {
      // A develop round changes the code — any prior clean audit is stale, so re-audit when it drains.
      auditedClean: false,
      kind: "advance",
      state: { attempts: await autoRound(spiral, next, effective.within), round: next.round },
    };
  }
  const pass = runAuditPass(spiral.args.auth, spiral.cwd);
  if (pass.broke) {
    return { kind: "terminal", outcome: "audit-broken" };
  }
  if (pass.filed === 0) {
    // Stamp the HEAD SHA so the next watch tick knows this clean audit covered THIS exact tree.
    writeCleanAuditSha(spiral.cwd, headSha(spiral.cwd));
  }
  return { auditedClean: pass.filed === 0, kind: "advance", state };
}

/** Whether `outcome` is a non-terminal action (`develop` / `audit`) the loop runs another round for. */
function isAction(outcome: AutoOutcome): outcome is "audit" | "develop" {
  return outcome === "audit" || outcome === "develop";
}

/** The loop's carry between iterations — whether the last audit pass came back clean, and the running
 *  attempt/round counter. */
interface Carry {
  readonly auditedClean: boolean;
  readonly state: RoundState;
}

/** Record the loop's live status to `cwd`'s `.vow/loop-status.json` (best-effort, never throws) so the studio
 *  can observe the autonomous loop — `running` is whether a round is being decided/developed now, with the
 *  current round + the effective backlog / open-PR counts it saw and the time it advanced. */
function recordStatus(cwd: string, status: Readonly<LoopStatus>): void {
  writeLoopStatus(cwd, status);
}

/** One spiral iteration — read the live effective workload, record the loop's live status (so the studio can
 *  watch it), ask `autoDecision`, and either return the next `Carry` (an action ran) or a terminal EXIT CODE
 *  (the loop stops). Keeps `loop` a thin driver. */
async function step(spiral: Spiral, carry: Readonly<Carry>): Promise<Carry | number> {
  const effective = effectiveBacklog(spiral.cwd, carry.state.attempts);
  recordStatus(spiral.cwd, {
    backlog: effective.within.length,
    lastRound: new Date().toISOString(),
    openPrs: effective.settleable.length,
    round: carry.state.round,
    running: true,
  });
  const headChanged = resolveHeadChanged(spiral.cwd);
  const outcome = autoDecision({
    auditedClean: carry.auditedClean,
    backlog: effective.within.length,
    capDropped: effective.dropped.length,
    headChanged,
    maxRounds: spiral.args.maxRounds,
    openPrs: effective.settleable.length,
    round: carry.state.round,
  });
  if (!isAction(outcome)) {
    return reportOutcome(outcome, effective.dropped);
  }
  const advanced = await runDecision(spiral, outcome, { effective, state: carry.state });
  if (advanced.kind === "terminal") {
    return reportOutcome(advanced.outcome, effective.dropped);
  }
  return { auditedClean: advanced.auditedClean, state: advanced.state };
}

/** The auto-heal SPIRAL — until `autoDecision` says stop, either develop a round or, on an empty backlog,
 *  audit for new work; exit 0 when a full audit pass is clean (`done`), else 1 (the round cap `exhausted`, a
 *  cap-stuck `stalled`, or a broken `audit-broken`). The decision is the pure `autoDecision`, fed the
 *  EFFECTIVE workload (within-cap backlog + settleable PRs + cap-dropped count); this shells gh + runs the
 *  round or the audit pass. `auditedClean` carries a clean audit into the next decision -> findings-free. */
async function loop(args: AutoArgs, cwd: string): Promise<number> {
  const spiral: Spiral = { args, cwd };
  // Per-issue develop attempts across rounds — an issue at `DEFAULT_ATTEMPT_CAP` is dropped from the backlog.
  let carry: Carry = { auditedClean: false, state: { attempts: [], round: 0 } };
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- a round depends on the prior's merges; rounds ARE sequential
    const next = await step(spiral, carry);
    if (typeof next === "number") {
      /* The spiral reached a terminal outcome — record it idle so the studio shows the loop stopped, keeping
         the round it ended on so the studio can still show "last ran round N". */
      recordStatus(spiral.cwd, {
        backlog: 0,
        lastRound: new Date().toISOString(),
        openPrs: 0,
        round: carry.state.round,
        running: false,
      });
      return next;
    }
    carry = next;
  }
}

/** Whether the unsupervised auto loop is explicitly opted into — `--yes` on the command, or `VOW_AGENT_AUTO=1`
 *  in the env (the opt-in a scheduled/CI run sets). Without it `vow agent auto` REFUSES to start: it audits +
 *  develops + merges with no human in the loop, so no probe / typo / `--help` may ever launch it (#486). */
export function autoConfirmed(rest: readonly string[]): boolean {
  // oxlint-disable-next-line no-process-env -- the CI/scheduled opt-in for the otherwise-unsupervised loop
  return rest.includes("--yes") || process.env["VOW_AGENT_AUTO"] === "1";
}

/** The refusal shown when `vow agent auto` runs without the opt-in — names what it WOULD do + the flag to
 *  confirm, so the loud default is "explain, don't run" (never silently start the merge loop). */
function autoRefusal(args: AutoArgs): string {
  return [
    "vow agent auto: refusing to start the unsupervised self-heal loop without an explicit opt-in.",
    `  It would audit + develop every open issue and merge green PRs, up to ${args.maxRounds} rounds, via ${args.provider.name}.`,
    "  Re-run with --yes (or set VOW_AGENT_AUTO=1 for a scheduled run) to confirm.",
    "",
  ].join("\n");
}

/** `vow agent auto --yes [--provider <name>] [--auth subscription|api] [--max-rounds <n>]` — the self-heal
 *  SPIRAL: develop the backlog + settle the PRs each round; when it empties, audit the codebase + file
 *  findings as new work; loop until a full audit pass is findings-free (done) or the round cap (exhausted).
 *  REFUSES to start without `--yes` / `VOW_AGENT_AUTO=1` — the unsupervised merge loop is opt-in only (#486). */
export function runAuto(rest: readonly string[]): number | Promise<number> {
  const args = parseAuto(rest);
  if (typeof args === "string") {
    process.stderr.write(`${args}\n`);
    return 1;
  }
  if (!autoConfirmed(rest)) {
    process.stderr.write(autoRefusal(args));
    return 1;
  }
  return loop(args, process.cwd());
}
