import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  areaOf,
  draftArgs,
  dryRunReport,
  mapLimit,
  mergeArgs,
  mergeDecision,
  providerFor,
  realOps,
  runReport,
  runTask,
  teamFocus,
} from "@vow/agent";
import {
  claimIssue,
  headCommit,
  issueDetail,
  issueLabels,
  prCiState,
  prCiStateForHead,
  prMerged,
  recordEvent,
  releaseIssue,
  resolveProjectId,
  syncProjectStatus,
} from "@vow/observability";
// oxlint-disable-next-line no-duplicate-imports -- the @vow/observability value import above; PrCi needs a top-level type import
import type { PrCi } from "@vow/observability";
// oxlint-disable-next-line no-duplicate-imports -- the @vow/agent value import above; Provider needs a top-level type import
import type { Provider } from "@vow/agent";
import { execFileSync } from "node:child_process";
import { readPrompt } from "./agent-prompts.ts";

/**
 * The shared run/merge primitives behind `vow agent` — develop an issue in a worktree, run a fleet, and act
 * on a PR's CI (merge green / draft red). Both the front door (`agent.ts`) and the auto-heal loop
 * (`agent-auto.ts`) import from here, so the loop reuses the run + merge without an import cycle (the
 * no-cycle gate forbids one).
 */

/** The known provider names, for the unknown-provider error. */
const KNOWN_PROVIDERS = PROVIDERS.map((each) => each.name).join(", ");

/** The areas (an issue's `area:` label) whose work lives in a single test package, so the FAST per-fix-round
 *  gate can run ONLY that package's tests (`vp test <dir>`) instead of the whole-repo `pnpm -r test` (#676).
 *  An area absent here (or no `area:` label) has no single home → the fix round runs `vp lint` alone (still
 *  fast); CI runs the full suite on the PR either way, so a too-narrow scope never merges an untested change. */
const AREA_PACKAGE: Readonly<Record<string, string>> = {
  agent: "packages/agent",
  core: "packages/core",
  db: "packages/db",
  docs: "packages/docs",
  gate: "packages/gate",
  github: "packages/observability",
  mcp: "packages/mcp",
  observability: "packages/observability",
  router: "packages/router",
  store: "packages/store",
  theme: "packages/theme",
};

/** The FAST per-fix-round gate set for an issue's `area` — `vp lint` (whole-repo lint is fast; the suite is
 *  the slow part) plus the area's package tests when it maps to one (`vp test <dir>`). NOT the whole-repo
 *  `pnpm -r test` — a fix iteration must be bounded fast (#676). The thorough `finalGates` re-run once after
 *  the fix rounds converge, and CI runs the full suite on the PR, so a narrow fix-round never lands untested. */
export function fixGates(area: string): readonly string[] {
  const pkg = AREA_PACKAGE[area];
  if (typeof pkg === "string") {
    return ["vp lint", `vp test ${pkg}`];
  }
  return ["vp lint"];
}

/** The THOROUGH pre-PR gate set for an issue's `area` — the full lint + typecheck + format (`vp check`) plus
 *  the area's package tests when it maps to one (`vp test <dir>`). WORKTREE-SAFE by construction: it NEVER runs
 *  the whole-repo `pnpm -r test`, which throws "fatal: not a git repository" in a develop worktree (a worktree
 *  has a `.git` FILE, not a directory, and `packages/cli`'s agent-auto/audit tests + the vp-test path expansion
 *  need a real repo). That whole-repo failure drafted EVERY run, so nothing converged (#685). The full suite
 *  stays the CI backstop: a green worktree-local final verify -> a NON-DRAFT PR -> CI runs `pnpm -r test` in a
 *  real checkout -> the per-PR settle merges on CI green. The thorough gate differs from the fast `fixGates`
 *  only in `vp check` (vs. the fast `vp lint`) — both scope tests to the touched package, never the repo. */
export function finalGates(area: string): readonly string[] {
  const pkg = AREA_PACKAGE[area];
  if (typeof pkg === "string") {
    return ["vp check", `vp test ${pkg}`];
  }
  return ["vp check"];
}

/** How many issues `run-all` develops at once — capped so one machine isn't swamped by parallel agents. */
export const DEFAULT_CONCURRENCY = 3;

/** How the spawned provider authenticates — `subscription` (the default) or `api` (a pay-per-use key); the
 *  same union as @vow/agent's `Auth`, kept local so the cli needs no second @vow/agent type import. */
export type Auth = "api" | "subscription";

/** The issue number from `vow agent <cmd> <n>` — the first positive integer among the args after the
 *  sub-command (so a flag-first `run --provider codex 42` still finds 42), or 0 when none is present. */
export function issueArg(rest: readonly string[]): number {
  for (const arg of rest.slice(1)) {
    const num = Number(arg);
    if (Number.isInteger(num) && num > 0) {
      return num;
    }
  }
  return 0;
}

/** The value after `flag` in `rest` (`--provider codex` → `codex`), or "" when the flag/value is absent. */
export function flagValue(rest: readonly string[], flag: string): string {
  const at = rest.indexOf(flag);
  if (at === -1 || at + 1 >= rest.length) {
    return "";
  }
  return rest[at + 1] ?? "";
}

/** True when `flag` is present but its value is missing — the flag is the last token, or the next token is
 *  itself a flag (`--provider --json`). Lets the parser blame the missing value, not the absent provider. */
export function flagValueless(rest: readonly string[], flag: string): boolean {
  const at = rest.indexOf(flag);
  if (at === -1) {
    return false;
  }
  const next = rest[at + 1] ?? "";
  return next === "" || next.startsWith("--");
}

/** The auth choice from `--auth` — `api` (a pay-per-use key) only when explicit; subscription otherwise. */
export function authArg(rest: readonly string[]): Auth {
  if (flagValue(rest, "--auth") === "api") {
    return "api";
  }
  return "subscription";
}

/** A validated `vow agent run` invocation — the issue, the resolved provider, and the auth choice. */
export interface RunArgs {
  readonly auth: Auth;
  readonly issue: number;
  readonly json: boolean;
  readonly provider: Provider;
}

/** Parse + validate `vow agent run` args (issue + provider + auth + `--json`), or a usage/error string. */
export function parseRun(rest: readonly string[]): RunArgs | string {
  const issue = issueArg(rest);
  if (issue === 0) {
    return "usage: vow agent run <n> [--provider <name>] [--auth subscription|api] [--json]";
  }
  if (flagValueless(rest, "--provider")) {
    return "vow agent run: --provider needs a value";
  }
  const provider = providerFor(flagValue(rest, "--provider") || DEFAULT_PROVIDER);
  if (!provider) {
    return `vow agent run: unknown provider (known: ${KNOWN_PROVIDERS})`;
  }
  return { auth: authArg(rest), issue, json: rest.includes("--json"), provider };
}

/** Exit 0 when the verdict holds, else 1. */
export function exitFor(ok: boolean): number {
  if (ok) {
    return 0;
  }
  return 1;
}

/** `vow agent run <n> --dry-run [--provider <name>]` — preview the run (branch, command, gates). */
export function runDry(args: RunArgs): number {
  process.stdout.write(`${dryRunReport(issueDetail(process.cwd(), args.issue), args.provider)}\n`);
  return 0;
}

/** A developed issue's outcome — the gate verdict + the formatted run report. */
export interface DevResult {
  readonly ok: boolean;
  readonly report: string;
}

/** What `develop` needs for one issue — the issue, the resolved provider, the auth choice, and the cwd. */
export interface DevInput {
  readonly auth: Auth;
  readonly cwd: string;
  readonly issue: number;
  readonly json: boolean;
  readonly provider: Provider;
}

/** A live-progress line for a phase — NDJSON (for an LLM / the studio) or human text (the terminal). */
export function phaseLine(issue: number, phase: string, json: boolean): string {
  if (json) {
    return JSON.stringify({ issue, phase });
  }
  return `  [#${issue}] ${phase}`;
}

/** Develop one issue via the live loop — worktree → dispatch the provider → re-run the gates — emitting
 *  each phase live; the report is the text run-report or, in `--json` mode, a compact `{issue, ok}`. */
async function developClaimed(input: DevInput): Promise<DevResult> {
  const { auth, cwd, issue, json, provider } = input;
  const spec = issueDetail(cwd, issue);
  // Route the issue to its area's TEAM specialist and inject THAT agent's COMPLETE brief (its role +
  // Discipline + vow's wall) into the develop plan — not a thin roster sketch. The builder is the default.
  const area = areaOf(issueLabels(cwd, issue));
  const focus = teamFocus(area);
  const outcome = await runTask({
    auth,
    // Thread the scaffolded plan TEMPLATE into the LIVE run, so a user-edited `.claude/prompts/plan.md`
    // Drives the agent's actual plan — not only the `vow agent plan` preview (else preview/run diverge).
    // The fast `verify` gates bound each fix round (#676); `finalVerify` is the thorough pre-PR wall.
    context: {
      commit: headCommit(cwd),
      finalVerify: finalGates(area),
      focus,
      planTemplate: readPrompt(cwd, "plan"),
      verify: fixGates(area),
    },
    cwd,
    issue: spec,
    onPhase: (phase) => {
      process.stdout.write(`${phaseLine(issue, phase, json)}\n`);
      recordEvent(cwd, "run.phase", { issue, phase });
    },
    ops: realOps(),
    provider,
  });
  const { ok } = outcome.verdict;
  if (json) {
    return { ok, report: JSON.stringify({ issue, ok }) };
  }
  return { ok, report: runReport(spec, outcome) };
}

/** Develop one issue, bracketing the live run with the board claim: apply `in-progress` so the board reads
 *  `doing` from the moment the agent starts (not only once a PR exists, #479), and release it when the run
 *  ends — a merged/open PR then carries the status, a failed run drops back to `planned`. Both halves are
 *  best-effort (they never throw), so a board hiccup can't fail the develop. */
/** The `detail` an `run.finished` event carries — the run's verdict as a word for the trace. */
function runOutcome(ok: boolean): string {
  if (ok) {
    return "ok";
  }
  return "failed";
}

export async function develop(input: DevInput): Promise<DevResult> {
  recordEvent(input.cwd, "run.started", { issue: input.issue });
  claimIssue(input.cwd, input.issue);
  try {
    const result = await developClaimed(input);
    recordEvent(input.cwd, "run.finished", { detail: runOutcome(result.ok), issue: input.issue });
    return result;
  } finally {
    releaseIssue(input.cwd, input.issue);
  }
}

/** `vow agent run <n> [--provider <name>]` (live) — develop the issue, print its report, exit on the
 *  verdict (non-zero when a gate fails — the runner would open a draft, not merge). */
export async function runLive(args: RunArgs): Promise<number> {
  const { ok, report } = await develop({
    auth: args.auth,
    cwd: process.cwd(),
    issue: args.issue,
    json: args.json,
    provider: args.provider,
  });
  process.stdout.write(`${report}\n`);
  return exitFor(ok);
}

/** The positive issue numbers among `rest` (the args after the sub-command) — flags + non-numbers dropped. */
export function issueNumbers(rest: readonly string[]): number[] {
  const out: number[] = [];
  for (const arg of rest.slice(1)) {
    const num = Number(arg);
    if (Number.isInteger(num) && num > 0) {
      out.push(num);
    }
  }
  return out;
}

/** A validated `vow agent run-all` invocation — the issue numbers + the resolved provider. */
export interface RunAllArgs {
  readonly auth: Auth;
  readonly issues: readonly number[];
  readonly json: boolean;
  readonly provider: Provider;
}

/** Parse + validate `run-all` args (issues + provider + auth + `--json`), or a usage/error string. The issue
 *  numbers are DEDUPED (`run-all 5 5` -> one lane for #5): two lanes for one issue derive the same branch +
 *  worktree path, and the loser's teardown would force-remove the winner's live worktree. */
export function parseRunAll(rest: readonly string[]): RunAllArgs | string {
  const issues = [...new Set(issueNumbers(rest))];
  if (issues.length === 0) {
    return "usage: vow agent run-all <n>... [--provider <name>] [--auth subscription|api] [--json]";
  }
  if (flagValueless(rest, "--provider")) {
    return "vow agent run-all: --provider needs a value";
  }
  const provider = providerFor(flagValue(rest, "--provider") || DEFAULT_PROVIDER);
  if (!provider) {
    return `vow agent run-all: unknown provider (known: ${KNOWN_PROVIDERS})`;
  }
  return { auth: authArg(rest), issues, json: rest.includes("--json"), provider };
}

/** The fleet header line (with newline) — how many issues, which, and the lane cap; empty in `--json` mode
 *  (the per-event JSON is self-describing, so no human banner). */
function fleetHeader(issues: readonly number[], json: boolean): string {
  if (json) {
    return "";
  }
  const tags = issues.map((each) => `#${each}`).join(", ");
  return `fleet: ${issues.length} issues [${tags}], up to ${DEFAULT_CONCURRENCY} at once\n`;
}

/** The message of a thrown value — an `Error`'s `.message`, else its string form. */
export function errorReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** A failed `DevResult` for an issue whose worktree setup (or any develop step) threw — so one bad lane
 *  only fails its own issue, never the whole fleet. The report mirrors `develop`: compact `{issue, ok}` in
 *  `--json` mode, a human line naming the error otherwise. */
export function failedResult(issue: number, error: unknown, json: boolean): DevResult {
  if (json) {
    return { ok: false, report: JSON.stringify({ issue, ok: false }) };
  }
  return { ok: false, report: `issue #${issue}: failed to develop — ${errorReason(error)}` };
}

/** Print the fleet's results — NDJSON (one per line) in `--json` mode, the spaced text reports otherwise. */
function printResults(done: readonly DevResult[], json: boolean): void {
  if (json) {
    process.stdout.write(`${done.map((each) => each.report).join("\n")}\n`);
    return;
  }
  process.stdout.write(`\n${done.map((each) => each.report).join("\n\n")}\n`);
}

/** `vow agent run-all <n>... [--provider <name>] [--json]` — develop several issues concurrently (each in
 *  its own worktree, capped), stream progress, exit non-zero if any gate failed. vow's own orchestration. */
export async function runAll(rest: readonly string[]): Promise<number> {
  const parsed = parseRunAll(rest);
  if (typeof parsed === "string") {
    process.stderr.write(`${parsed}\n`);
    return 1;
  }
  const cwd = process.cwd();
  process.stdout.write(fleetHeader(parsed.issues, parsed.json));
  const worker = async (issue: number): Promise<DevResult> => {
    try {
      return await develop({
        auth: parsed.auth,
        cwd,
        issue,
        json: parsed.json,
        provider: parsed.provider,
      });
    } catch (error) {
      // A throw here (`git worktree add` or `vp install` failing) must fail only this lane, not reject the
      // Promise.all in mapLimit and discard the other lanes. A failed result keeps the fleet's exit non-zero.
      return failedResult(issue, error, parsed.json);
    }
  };
  const done = await mapLimit(parsed.issues, DEFAULT_CONCURRENCY, worker);
  printResults(done, parsed.json);
  return exitFor(done.every((each) => each.ok));
}

/** Reconcile the GitHub Project's Status to the studio's derived status right after a merge (the moment an
 *  issue closes), so the board never drifts — and return the line to print. The Project node id comes from
 *  `VOW_PROJECT_ID` or, when that is unset, the studio config's `project:` URL — so the sync runs without a
 *  shell env var instead of silently skipping. Empty (no line) only when neither is configured; local gh
 *  auth, no PAT. May throw if `gh project` hiccups — the caller treats that best-effort
 *  (`reconcileAfterMerge`), since the merge, not the reconcile, is load-bearing. */
export function boardLine(cwd: string): string {
  // oxlint-disable-next-line no-process-env -- the configured Project node id; absent = fall back to config
  const pid = resolveProjectId(cwd, process.env["VOW_PROJECT_ID"]);
  if (typeof pid !== "string") {
    return "";
  }
  const { changed, matched } = syncProjectStatus(cwd, pid);
  return `board: ${changed.length} reconciled, ${matched} matched`;
}

/** Run the post-merge board reconcile BEST-EFFORT: the merge is the load-bearing effect, the reconcile is
 *  advisory (`vow sync-project` / the MCP can re-run it), so a `gh project` hiccup must NEVER report a
 *  succeeded merge as failed. Returns the board line on success, or a `merged — board sync skipped: <why>`
 *  warning when `sync` throws — either way a string the caller prints, never a propagated throw. */
export function reconcileAfterMerge(pr: number, sync: () => string): string {
  try {
    return sync();
  } catch (error) {
    return `pr #${pr}: merged — board sync skipped: ${errorReason(error)}`;
  }
}

/** Decide a merge's outcome when `gh pr merge` exited non-zero: the merge may still have landed (gh also
 *  fails for post-merge cleanup — e.g. `--delete-branch` blocked by a leftover worktree holding the local
 *  branch), so judge by the PR's actual state, not the exit code. Returns a `merged — gh cleanup warning`
 *  line when the pr is MERGED (a success despite the hiccup), or "" to re-raise a genuine failure (#468). */
export function mergeFallback(pr: number, merged: boolean, error: unknown): string {
  if (merged) {
    return `pr #${pr}: merged — gh cleanup warning: ${errorReason(error)}`;
  }
  return "";
}

/** Run `gh pr merge` for PR `pr`, tolerating a post-merge cleanup hiccup: a non-zero exit whose merge
 *  actually landed (the PR reads MERGED) is warned + continued, only a genuinely-unmerged PR re-raises. A
 *  non-empty `expectedHead` pins the merge to that SHA server-side (`--match-head-commit`), so a push between
 *  the green read and this call exits non-zero with the PR still OPEN -> `prMerged` false -> re-raise. */
function execMerge(pr: number, cwd: string, expectedHead: string): void {
  try {
    execFileSync("gh", [...mergeArgs(pr, expectedHead)], { cwd, stdio: "inherit" });
  } catch (error) {
    const warning = mergeFallback(pr, prMerged(cwd, pr), error);
    if (warning === "") {
      throw error;
    }
    process.stdout.write(`${warning}\n`);
  }
}

/** Squash-merge a green PR via gh — the agent closing the loop on a passing run — then reconcile the board
 *  best-effort (the merge closed the issue, so its derived status just became Done; the built-ins don't
 *  catch this). A non-empty `expectedHead` pins the merge to that SHA (`--match-head-commit`), closing the
 *  TOCTOU window between the pinned-green CI read and this call (#471); empty = the unpinned front door. Two
 *  post-merge false-negatives are guarded: a `gh pr merge` non-zero exit whose merge actually landed is
 *  judged by the PR's MERGED state, not the exit code (#468); a board-sync hiccup is swallowed + warned
 *  (#466). Neither reports a merge that happened as failed WHEN THE PR STATE IS READABLE; an unreadable state
 *  fail-closes and re-raises (safe — the auto loop drops a merged PR from the next round). */
export function mergePr(pr: number, cwd: string, expectedHead: string): number {
  execMerge(pr, cwd, expectedHead);
  process.stdout.write(`pr #${pr}: merged (green CI)\n`);
  recordEvent(cwd, "pr.merged", { pr });
  const line = reconcileAfterMerge(pr, () => boardLine(cwd));
  if (line !== "") {
    process.stdout.write(`${line}\n`);
  }
  return 0;
}

/** Flip a red PR back to draft via gh — surfaced for a human, never merged off red. */
export function draftPr(pr: number, cwd: string): number {
  execFileSync("gh", [...draftArgs(pr)], { cwd, stdio: "inherit" });
  process.stdout.write(`pr #${pr}: set to draft (red CI — surfaced, not merged)\n`);
  return 0;
}

/** A CI verdict + the head it was read against — the merge pins to `expectedHead` (`--match-head-commit`)
 *  when non-empty, leaving the unpinned front door to pass `""`. Bundled so `actOnCi` stays within the
 *  max-params gate. */
interface Verdict {
  readonly ci: PrCi;
  readonly expectedHead: string;
}

/** Act on a CI verdict for PR `pr` — merge a green run, draft a red one, or report pending. A non-empty
 *  `verdict.expectedHead` pins the merge to that SHA (`--match-head-commit`); empty leaves it unpinned. */
function actOnCi(pr: number, cwd: string, verdict: Verdict): number {
  const decision = mergeDecision(verdict.ci);
  if (decision === "merge") {
    return mergePr(pr, cwd, verdict.expectedHead);
  }
  if (decision === "draft") {
    return draftPr(pr, cwd);
  }
  process.stdout.write(`pr #${pr}: CI pending — not merged; re-run when checks complete\n`);
  return 1;
}

/** Read PR `pr`'s CI and act on the decision — merge a green run, draft a red one, or report pending. The
 *  explicit `vow agent merge <pr>` front door: an UNPINNED merge (empty `expectedHead`), its documented
 *  semantics — no `--match-head-commit`. */
export function actOnPr(pr: number, cwd: string): number {
  return actOnCi(pr, cwd, { ci: prCiState(cwd, pr), expectedHead: "" });
}

/** Like `actOnPr`, but the verdict is PINNED to `expectedHead` — a green rollup only merges when it belongs
 *  to that exact head SHA. After an `update-branch` rebase, gh can still report the prior (green) run until
 *  the fresh one registers; pinning treats that stale read as pending so the loop waits, never merging a
 *  branch whose post-rebase CI never ran. The empty-pin semantics live in ONE place — the pure layer's
 *  `ciStateForHead` maps `""` -> pending — so a transient `prHeadOid` failure (head `""`) reads as pending
 *  (skip this round, re-read next) rather than un-pinning to the stale-green unpinned read. The same
 *  `expectedHead` is threaded to the merge as `--match-head-commit`, so a push between the pinned-green read
 *  and the merge call is rejected server-side (#471). The explicit `vow agent merge <pr>` front door keeps
 *  `actOnPr` for an unpinned read. */
export function actOnPrForHead(pr: number, cwd: string, expectedHead: string): number {
  return actOnCi(pr, cwd, { ci: prCiStateForHead(cwd, pr, expectedHead), expectedHead });
}
