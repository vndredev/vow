import {
  DEFAULT_PROVIDER,
  DEFAULT_ROSTER,
  PROVIDERS,
  agentFor,
  areaOf,
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
import {
  auditIssue,
  createIssue,
  headCommit,
  issueDetail,
  issueLabels,
  parseFindings,
  prCiState,
} from "@vow/observability";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** How the spawned provider authenticates — `subscription` (the default) or `api` (a pay-per-use key); the
 *  same union as @vow/agent's `Auth`, kept local so the cli needs no second @vow/agent type import. */
type Auth = "api" | "subscription";

/** The auth choice from `--auth` — `api` (a pay-per-use key) only when explicit; subscription otherwise. */
function authArg(rest: readonly string[]): Auth {
  if (flagValue(rest, "--auth") === "api") {
    return "api";
  }
  return "subscription";
}

/** A validated `vow agent run` invocation — the issue, the resolved provider, and the auth choice. */
interface RunArgs {
  readonly auth: Auth;
  readonly issue: number;
  readonly json: boolean;
  readonly provider: Provider;
}

/** Parse + validate `vow agent run` args (issue + provider + auth + `--json`), or a usage/error string. */
function parseRun(rest: readonly string[]): RunArgs | string {
  const issue = issueArg(rest);
  if (issue === 0) {
    return "usage: vow agent run <n> [--provider <name>] [--auth subscription|api] [--json]";
  }
  const provider = providerFor(flagValue(rest, "--provider") || DEFAULT_PROVIDER);
  if (!provider) {
    return `vow agent run: unknown provider (known: ${KNOWN_PROVIDERS})`;
  }
  return { auth: authArg(rest), issue, json: rest.includes("--json"), provider };
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

/** What `develop` needs for one issue — the issue, the resolved provider, the auth choice, and the cwd. */
interface DevInput {
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
async function develop(input: DevInput): Promise<DevResult> {
  const { auth, cwd, issue, json, provider } = input;
  const spec = issueDetail(cwd, issue);
  // Route to the area's specialist (the roster) — its focus narrows the executor to the issue's concern.
  const { focus } = agentFor(DEFAULT_ROSTER, areaOf(issueLabels(cwd, issue)));
  const outcome = await runTask({
    auth,
    context: { commit: headCommit(cwd), focus, verify: RUN_GATES },
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
async function runLive(args: RunArgs): Promise<number> {
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
  readonly auth: Auth;
  readonly issues: readonly number[];
  readonly json: boolean;
  readonly provider: Provider;
}

/** Parse + validate `run-all` args (issues + provider + auth + `--json`), or a usage/error string. */
function parseRunAll(rest: readonly string[]): RunAllArgs | string {
  const issues = issueNumbers(rest);
  if (issues.length === 0) {
    return "usage: vow agent run-all <n>... [--provider <name>] [--auth subscription|api] [--json]";
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
async function runAll(rest: readonly string[]): Promise<number> {
  const parsed = parseRunAll(rest);
  if (typeof parsed === "string") {
    process.stderr.write(`${parsed}\n`);
    return 1;
  }
  const cwd = process.cwd();
  process.stdout.write(fleetHeader(parsed.issues, parsed.json));
  const worker = async (issue: number): Promise<DevResult> => {
    const result = await develop({
      auth: parsed.auth,
      cwd,
      issue,
      json: parsed.json,
      provider: parsed.provider,
    });
    return result;
  };
  const done = await mapLimit(parsed.issues, DEFAULT_CONCURRENCY, worker);
  printResults(done, parsed.json);
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

/** `vow agent audit --file <findings.json>` — file each confirmed finding as a labelled, milestoned vow
 *  issue (the audit → plan step; the plan lives in vow, never a side file). Prints each issue URL. */
function runAudit(rest: readonly string[]): number {
  const file = flagValue(rest, "--file");
  if (file === "") {
    process.stderr.write("usage: vow agent audit --file <findings.json>\n");
    return 1;
  }
  const cwd = process.cwd();
  const findings = parseFindings(readFileSync(file, "utf8"));
  for (const finding of findings) {
    process.stdout.write(`${createIssue(cwd, auditIssue(finding))}\n`);
  }
  process.stdout.write(`filed ${findings.length} issue(s)\n`);
  return 0;
}

/** The agent-native sub-commands by name — keeps the front door flat (no long if-chain). */
const SUBCOMMANDS: Record<string, (rest: readonly string[]) => number | Promise<number>> = {
  audit: runAudit,
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
  process.stderr.write("usage: vow agent <init|plan|run|run-all|merge|audit>\n");
  return 1;
}
