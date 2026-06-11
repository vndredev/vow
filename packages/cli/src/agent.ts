import { agentsMd, vowDevelopSkill } from "./agent-templates.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { headCommit, issueDetail } from "@vow/observability";
import { buildPlan } from "@vow/agent";
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

/** `vow agent <sub>` — the agent-native front door: `init` (scaffold the integration) + `plan <n>` (the
 *  executor-ready plan for an issue). */
export function agent(rest: readonly string[]): number {
  const [sub] = rest;
  if (sub === "init") {
    return init(process.cwd());
  }
  if (sub === "plan") {
    return runPlan(rest);
  }
  process.stderr.write("usage: vow agent <init|plan>\n");
  return 1;
}
