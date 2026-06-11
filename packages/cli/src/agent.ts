import { DEFAULT_PROVIDER, PROVIDERS, buildPlan, dryRunReport, providerFor } from "@vow/agent";
import { agentsMd, vowDevelopSkill } from "./agent-templates.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { headCommit, issueDetail } from "@vow/observability";
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

/** `vow agent run <n> --dry-run [--provider <name>]` — preview the run (branch, command, gates). The live
 *  run isn't wired yet, so `--dry-run` is required; without it the usage is shown. */
function runDry(rest: readonly string[]): number {
  const issue = issueArg(rest);
  if (issue === 0 || !rest.includes("--dry-run")) {
    process.stderr.write("usage: vow agent run <issue-number> --dry-run [--provider <name>]\n");
    return 1;
  }
  const provider = providerFor(flagValue(rest, "--provider") || DEFAULT_PROVIDER);
  if (!provider) {
    process.stderr.write(`vow agent run: unknown provider (known: ${KNOWN_PROVIDERS})\n`);
    return 1;
  }
  process.stdout.write(`${dryRunReport(issueDetail(process.cwd(), issue), provider)}\n`);
  return 0;
}

/** `vow agent <sub>` — the agent-native front door: `init` (scaffold) · `plan <n>` (the executor-ready
 *  plan) · `run <n> --dry-run` (preview the provider command). */
export function agent(rest: readonly string[]): number {
  const [sub] = rest;
  if (sub === "init") {
    return init(process.cwd());
  }
  if (sub === "plan") {
    return runPlan(rest);
  }
  if (sub === "run") {
    return runDry(rest);
  }
  process.stderr.write("usage: vow agent <init|plan|run>\n");
  return 1;
}
