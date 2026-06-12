import {
  DEFAULT_PROVIDER,
  DEFAULT_ROSTER,
  PROVIDERS,
  agentFor,
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
} from "@vow/agent";
import {
  headCommit,
  issueDetail,
  issueLabels,
  prCiState,
  prCiStateForHead,
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

/** The gates `vow agent run` re-runs in the worktree after the provider, before deciding merge vs. draft. */
const RUN_GATES: readonly string[] = ["vp check", "pnpm -r test"];

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
export async function develop(input: DevInput): Promise<DevResult> {
  const { auth, cwd, issue, json, provider } = input;
  const spec = issueDetail(cwd, issue);
  // Route to the area's specialist (the roster) — its focus narrows the executor to the issue's concern.
  const { focus } = agentFor(DEFAULT_ROSTER, areaOf(issueLabels(cwd, issue)));
  const outcome = await runTask({
    auth,
    // Thread the scaffolded plan TEMPLATE into the LIVE run, so a user-edited `.claude/prompts/plan.md`
    // Drives the agent's actual plan — not only the `vow agent plan` preview (else preview/run diverge).
    context: {
      commit: headCommit(cwd),
      focus,
      planTemplate: readPrompt(cwd, "plan"),
      verify: RUN_GATES,
    },
    cwd,
    issue: spec,
    onPhase: (phase) => {
      process.stdout.write(`${phaseLine(issue, phase, json)}\n`);
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
function errorReason(error: unknown): string {
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
 *  issue closes), so the board never drifts. No-op when `VOW_PROJECT_ID` is unset; local gh auth, no PAT. */
function syncBoard(cwd: string): void {
  // oxlint-disable-next-line no-process-env -- the configured Project node id; absent = no board to sync
  const pid = process.env["VOW_PROJECT_ID"] ?? "";
  if (pid === "") {
    return;
  }
  const { changed, matched } = syncProjectStatus(cwd, pid);
  process.stdout.write(`board: ${changed.length} reconciled, ${matched} matched\n`);
}

/** Squash-merge a green PR via gh — the agent closing the loop on a passing run — then reconcile the board
 *  (the merge closed the issue, so its derived status just became Done; the built-ins don't catch this). */
export function mergePr(pr: number, cwd: string): number {
  execFileSync("gh", [...mergeArgs(pr)], { cwd, stdio: "inherit" });
  process.stdout.write(`pr #${pr}: merged (green CI)\n`);
  syncBoard(cwd);
  return 0;
}

/** Flip a red PR back to draft via gh — surfaced for a human, never merged off red. */
export function draftPr(pr: number, cwd: string): number {
  execFileSync("gh", [...draftArgs(pr)], { cwd, stdio: "inherit" });
  process.stdout.write(`pr #${pr}: set to draft (red CI — surfaced, not merged)\n`);
  return 0;
}

/** Act on a CI verdict for PR `pr` — merge a green run, draft a red one, or report pending. */
function actOnCi(pr: number, cwd: string, ci: PrCi): number {
  const decision = mergeDecision(ci);
  if (decision === "merge") {
    return mergePr(pr, cwd);
  }
  if (decision === "draft") {
    return draftPr(pr, cwd);
  }
  process.stdout.write(`pr #${pr}: CI pending — not merged; re-run when checks complete\n`);
  return 1;
}

/** Read PR `pr`'s CI and act on the decision — merge a green run, draft a red one, or report pending. */
export function actOnPr(pr: number, cwd: string): number {
  return actOnCi(pr, cwd, prCiState(cwd, pr));
}

/** Like `actOnPr`, but the verdict is PINNED to `expectedHead` — a green rollup only merges when it belongs
 *  to that exact head SHA. After an `update-branch` rebase, gh can still report the prior (green) run until
 *  the fresh one registers; pinning treats that stale read as pending so the loop waits, never merging a
 *  branch whose post-rebase CI never ran. The empty-pin semantics live in ONE place — the pure layer's
 *  `ciStateForHead` maps `""` -> pending — so a transient `prHeadOid` failure (head `""`) reads as pending
 *  (skip this round, re-read next) rather than un-pinning to the stale-green unpinned read. The explicit
 *  `vow agent merge <pr>` front door keeps `actOnPr` for an unpinned read. */
export function actOnPrForHead(pr: number, cwd: string, expectedHead: string): number {
  return actOnCi(pr, cwd, prCiStateForHead(cwd, pr, expectedHead));
}
