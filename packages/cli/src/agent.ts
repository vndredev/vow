import { actOnPr, flagValue, issueArg, parseRun, runAll, runDry, runLive } from "./agent-run.ts";
import {
  agentsMd,
  vowAuditSkill,
  vowDevelopSkill,
  vowOrchestrateSkill,
} from "./agent-templates.ts";
import {
  auditIssue,
  auditPrompt,
  createIssue,
  headCommit,
  issueDetail,
  parseFindings,
} from "@vow/observability";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildPlan } from "@vow/agent";
import path from "node:path";
import { runAuto } from "./agent-auto.ts";

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
 *  AGENTS.md contract + the develop & orchestrate skills. Idempotent — re-running keeps every file. */
function init(cwd: string): number {
  const actions = [
    scaffold(path.join(cwd, "AGENTS.md"), agentsMd()),
    scaffold(path.join(cwd, ".claude", "skills", "vow-develop", "SKILL.md"), vowDevelopSkill()),
    scaffold(
      path.join(cwd, ".claude", "skills", "vow-orchestrate", "SKILL.md"),
      vowOrchestrateSkill(),
    ),
    scaffold(path.join(cwd, ".claude", "skills", "vow-audit", "SKILL.md"), vowAuditSkill()),
  ];
  for (const action of actions) {
    process.stdout.write(`  ${action}\n`);
  }
  return 0;
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

/** File each finding from a findings JSON file as a labelled, milestoned vow issue; prints each URL + a
 *  count (the audit -> plan step — findings become issues, never a side-file). */
function runAuditFile(file: string): number {
  const cwd = process.cwd();
  const findings = parseFindings(readFileSync(file, "utf8"));
  for (const finding of findings) {
    process.stdout.write(`${createIssue(cwd, auditIssue(finding))}\n`);
  }
  process.stdout.write(`filed ${findings.length} issue(s)\n`);
  return 0;
}

/** `vow agent audit --prompt <dimension>` prints an audit agent's instruction; `--file <findings.json>`
 *  files the findings as vow issues (the audit -> plan flow, a host workflow fanning out the audit between
 *  the two). */
function runAudit(rest: readonly string[]): number {
  const dimension = flagValue(rest, "--prompt");
  if (dimension !== "") {
    process.stdout.write(`${auditPrompt(dimension)}\n`);
    return 0;
  }
  const file = flagValue(rest, "--file");
  if (file !== "") {
    return runAuditFile(file);
  }
  process.stderr.write("usage: vow agent audit (--prompt <dimension> | --file <findings.json>)\n");
  return 1;
}

/** The agent-native sub-commands by name — keeps the front door flat (no long if-chain). */
const SUBCOMMANDS: Record<string, (rest: readonly string[]) => number | Promise<number>> = {
  audit: runAudit,
  auto: runAuto,
  init: () => init(process.cwd()),
  merge: runMerge,
  plan: runPlan,
  run: runAgent,
  "run-all": runAll,
};

/** `vow agent <sub>` — the agent-native front door: `init` (scaffold) · `plan <n>` (the executor-ready
 *  plan) · `run <n> [--dry-run]` (the live run / preview) · `run-all <n>...` (a fleet) · `merge <pr>` (merge
 *  a green PR / draft a red) · `auto` (the self-heal loop) · `audit` (findings -> issues). */
export function agent(rest: readonly string[]): number | Promise<number> {
  const [sub] = rest;
  const handler = SUBCOMMANDS[sub ?? ""];
  if (handler) {
    return handler(rest);
  }
  process.stderr.write("usage: vow agent <init|plan|run|run-all|merge|auto|audit>\n");
  return 1;
}
