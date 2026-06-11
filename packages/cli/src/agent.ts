import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  buildPlan,
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
import { agentsMd, vowDevelopSkill } from "./agent-templates.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { headCommit, issueDetail, prCiState } from "@vow/observability";
// oxlint-disable-next-line no-duplicate-imports -- the @vow/agent value import above; Provider needs a top-level type import
import type { Provider } from "@vow/agent";
import { execFileSync } from "node:child_process";
import path from "node:path";

/** Write `content` to `file` only when absent — `init` is idempotent, never clobbering edits. Returns the
 *  action taken, for the report. */
function scaffold(file: string, content: string): string {
  if (existsSync(file)) {
    return `kept  ${file}`;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return `wrote ${file}`;
}

/** `vow agent init` — scaffold the repo's agent integration so any coding agent works THROUGH vow: the
 *  AGENTS.md contract + a develop skill. Idempotent — re-running keeps every existing file. */
function init(cwd: string): number {
  const actions = [
    scaffold(path.join(cwd, "AGENTS.md"), agentsMd()),
    scaffold(path.join(cwd, ".claude", "skills", "vow-develop", "SKILL.md"), vowDevelopSkill()),
  ];
  for (const action of actions) {
    process.stdout.write(`  ${action}\n`);
  }
  return 0;
}

/** The issue number from `vow agent plan <n>` — a positive integer, or 0 when missing/non-numeric. */
export function issueArg(rest: readonly string[]): number {
  const raw = rest[1] ?? "";
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    return 0;
  }
  return num;
}

/** `vow agent plan <n>` — print the self-contained, verification-gated plan an autonomous run develops for
 *  issue `n` (the executor's product). Reads the issue + HEAD; emits no side effects. */
function plan(cwd: string, issue: number): number {
  const spec = issueDetail(cwd, issue);
  process.stdout.write(`${buildPlan(spec, { commit: headCommit(cwd), verify: [] })}\n`);
  return 0;
}

/** Handle `vow agent plan <n>` — validate the issue arg, then print its plan (or the usage on a bad arg). */
function runPlan(rest: readonly string[]): number {
  const issue = issueArg(rest);
  if (issue === 0) {
    process.stderr.write("usage: vow agent plan <issue-number>\n");
    return 1;
  }
  return plan(process.cwd(), issue);
}

/** The value after `flag` in `rest` (`--provider codex` → `codex`), or "" when the flag/value is absent. */
export function flagValue(rest: readonly string[], flag: string): string {
  const at = rest.indexOf(flag);
  if (at === -1 || at + 1 >= rest.length) {
    return "";
  }
  return rest[at + 1] ?? "";
}

/** The known provider names, for the unknown-provider error. */
const KNOWN_PROVIDERS = PROVIDERS.map((each) => each.name).join(", ");

/** The gates `vow agent run` re-runs in the worktree after the provider, before deciding merge vs. draft. */
const RUN_GATES: readonly string[] = ["vp check", "pnpm -r test"];

/** A validated `vow agent run` invocation — the issue number + the resolved provider. */
interface RunArgs {
  readonly issue: number;
  readonly provider: Provider;
}

/** Parse + validate `vow agent run` args (issue number + provider), or a usage/error string to print. */
function parseRun(rest: readonly string[]): RunArgs | string {
  const issue = issueArg(rest);
  if (issue === 0) {
    return "usage: vow agent run <issue-number> [--dry-run] [--provider <name>]";
  }
  const provider = providerFor(flagValue(rest, "--provider") || DEFAULT_PROVIDER);
  if (!provider) {
    return `vow agent run: unknown provider (known: ${KNOWN_PROVIDERS})`;
  }
  return { issue, provider };
}

/** Exit 0 when the verdict holds, else 1. */
function exitFor(ok: boolean): number {
  if (ok) {
    return 0;
  }
  return 1;
}

/** `vow agent run <n> --dry-run [--provider <name>]` — preview the run (branch, command, gates). */
function runDry(args: RunArgs): number {
  process.stdout.write(`${dryRunReport(issueDetail(process.cwd(), args.issue), args.provider)}\n`);
  return 0;
}

/** A developed issue's outcome — the gate verdict + the formatted run report. */
interface DevResult {
  readonly ok: boolean;
  readonly report: string;
}

/** Develop one issue via the live loop — worktree → dispatch the provider → re-run the gates — and format
 *  its report; `ok` is the gate verdict (drives the exit / merge-vs-draft, and run-all's overall result). */
async function develop(issue: number, provider: Provider, cwd: string): Promise<DevResult> {
  const spec = issueDetail(cwd, issue);
  const outcome = await runTask({
    context: { commit: headCommit(cwd), verify: RUN_GATES },
    cwd,
    issue: spec,
    ops: realOps(),
    provider,
  });
  return { ok: outcome.verdict.ok, report: runReport(spec, outcome) };
}

/** `vow agent run <n> [--provider <name>]` (live) — develop the issue, print its report, exit on the
 *  verdict (non-zero when a gate fails — the runner would open a draft, not merge). */
async function runLive(args: RunArgs): Promise<number> {
  const { ok, report } = await develop(args.issue, args.provider, process.cwd());
  process.stdout.write(`${report}\n`);
  return exitFor(ok);
}

/** Route `vow agent run` — `--dry-run` previews; otherwise the live run. */
function runAgent(rest: readonly string[]): number | Promise<number> {
  const args = parseRun(rest);
  if (typeof args === "string") {
    process.stderr.write(`${args}\n`);
    return 1;
  }
  if (rest.includes("--dry-run")) {
    return runDry(args);
  }
  return runLive(args);
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

/** How many issues `run-all` develops at once — capped so one machine isn't swamped by parallel agents. */
const DEFAULT_CONCURRENCY = 3;

/** A validated `vow agent run-all` invocation — the issue numbers + the resolved provider. */
interface RunAllArgs {
  readonly issues: readonly number[];
  readonly provider: Provider;
}

/** Parse + validate `run-all` args (issue numbers + provider), or a usage/error string to print. */
function parseRunAll(rest: readonly string[]): RunAllArgs | string {
  const issues = issueNumbers(rest);
  if (issues.length === 0) {
    return "usage: vow agent run-all <issue-number>... [--provider <name>]";
  }
  const provider = providerFor(flagValue(rest, "--provider") || DEFAULT_PROVIDER);
  if (!provider) {
    return `vow agent run-all: unknown provider (known: ${KNOWN_PROVIDERS})`;
  }
  return { issues, provider };
}

/** `vow agent run-all <n>... [--provider <name>]` — develop several issues concurrently (each in its own
 *  worktree, capped), print every report, exit non-zero if any gate failed. vow's own orchestration. */
async function runAll(rest: readonly string[]): Promise<number> {
  const parsed = parseRunAll(rest);
  if (typeof parsed === "string") {
    process.stderr.write(`${parsed}\n`);
    return 1;
  }
  const cwd = process.cwd();
  const worker = async (issue: number): Promise<DevResult> => {
    const result = await develop(issue, parsed.provider, cwd);
    return result;
  };
  const done = await mapLimit(parsed.issues, DEFAULT_CONCURRENCY, worker);
  process.stdout.write(`${done.map((each) => each.report).join("\n\n")}\n`);
  return exitFor(done.every((each) => each.ok));
}

/** Squash-merge a green PR via gh — the agent closing the loop on a passing run. */
function mergePr(pr: number, cwd: string): number {
  execFileSync("gh", [...mergeArgs(pr)], { cwd, stdio: "inherit" });
  process.stdout.write(`pr #${pr}: merged (green CI)\n`);
  return 0;
}

/** Flip a red PR back to draft via gh — surfaced for a human, never merged off red. */
function draftPr(pr: number, cwd: string): number {
  execFileSync("gh", [...draftArgs(pr)], { cwd, stdio: "inherit" });
  process.stdout.write(`pr #${pr}: set to draft (red CI — surfaced, not merged)\n`);
  return 0;
}

/** Read PR `pr`'s CI and act on the decision — merge a green run, draft a red one, or report pending. */
function actOnPr(pr: number, cwd: string): number {
  const decision = mergeDecision(prCiState(cwd, pr));
  if (decision === "merge") {
    return mergePr(pr, cwd);
  }
  if (decision === "draft") {
    return draftPr(pr, cwd);
  }
  process.stdout.write(`pr #${pr}: CI pending — not merged; re-run when checks complete\n`);
  return 1;
}

/** `vow agent merge <pr>` — the autonomous merge: read the PR's CI, then merge green / draft red / wait
 *  pending. It closes the loop without ever merging off a failing gate. */
function runMerge(rest: readonly string[]): number {
  const pr = issueArg(rest);
  if (pr === 0) {
    process.stderr.write("usage: vow agent merge <pr-number>\n");
    return 1;
  }
  return actOnPr(pr, process.cwd());
}

/** The agent-native sub-commands by name — keeps the front door flat (no long if-chain). */
const SUBCOMMANDS: Record<string, (rest: readonly string[]) => number | Promise<number>> = {
  init: () => init(process.cwd()),
  merge: runMerge,
  plan: runPlan,
  run: runAgent,
  "run-all": runAll,
};

/** `vow agent <sub>` — the agent-native front door: `init` (scaffold) · `plan <n>` (the executor-ready
 *  plan) · `run <n> [--dry-run]` (the live run / preview) · `merge <pr>` (merge a green PR / draft a red). */
export function agent(rest: readonly string[]): number | Promise<number> {
  const [sub] = rest;
  const handler = SUBCOMMANDS[sub ?? ""];
  if (handler) {
    return handler(rest);
  }
  process.stderr.write("usage: vow agent <init|plan|run|run-all|merge>\n");
  return 1;
}
