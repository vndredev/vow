import { actOnPr, flagValue, issueArg, parseRun, runAll, runDry, runLive } from "./agent-run.ts";
import {
  agentsMd,
  vowAuditSkill,
  vowDevelopSkill,
  vowOrchestrateSkill,
} from "./agent-templates.ts";
import {
  auditIssue,
  createIssue,
  headCommit,
  issueDetail,
  parseFindings,
} from "@vow/observability";
import { buildPlan, promptTemplates, renderAuditPrompt } from "@vow/agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readPrompt } from "./agent-prompts.ts";
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

// The JSON indent for a written `.mcp.json`.
const JSON_INDENT = 2;

/** The `.mcp.json` entry that launches the channel — `vow channel`, path-independent (resolves the vow bin)
 *  so the install works in any repo, not a monorepo file path. */
const CHANNEL_ENTRY = { args: ["channel"], command: "vow" } as const;

/** Whether a value is a non-null object — the entry to safely read a parsed `.mcp.json`. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The existing `mcpServers` map of `.mcp.json`, or `{}` when the file is absent/malformed. */
function existingServers(file: string): Record<string, unknown> {
  if (!existsSync(file)) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (isObject(parsed) && isObject(parsed["mcpServers"])) {
      return parsed["mcpServers"];
    }
  } catch {
    return {};
  }
  return {};
}

/** Install the channel into `.mcp.json` (merge, idempotent) — the `vow-channel` server Claude Code spawns
 *  as the channel, beside whatever else is configured. Keeps a hand-edited entry; the CLI installs the
 *  Channels wiring so a user need not hand-edit `.mcp.json` (then `claude --dangerously-load-development-channels
 *  server:vow-channel`). */
function installChannel(cwd: string): string {
  const file = path.join(cwd, ".mcp.json");
  const servers = existingServers(file);
  if ("vow-channel" in servers) {
    return "kept  .mcp.json (vow-channel)";
  }
  const merged = { mcpServers: { ...servers, "vow-channel": CHANNEL_ENTRY } };
  writeFileSync(file, `${JSON.stringify(merged, (_key, value: unknown) => value, JSON_INDENT)}\n`);
  return "wrote .mcp.json (vow-channel)";
}

/** `vow agent init` — scaffold the repo's agent integration so any coding agent works THROUGH vow: the
 *  AGENTS.md contract + the develop/orchestrate/audit skills + the operative develop/audit/plan PROMPTS as
 *  editable provider templates (`.claude/prompts/<role>.md`, what the agent reads). Idempotent — re-running
 *  keeps every file, so a user-edited prompt is never clobbered. */
function init(cwd: string): number {
  const actions = [
    scaffold(path.join(cwd, "AGENTS.md"), agentsMd()),
    scaffold(path.join(cwd, ".claude", "skills", "vow-develop", "SKILL.md"), vowDevelopSkill()),
    scaffold(
      path.join(cwd, ".claude", "skills", "vow-orchestrate", "SKILL.md"),
      vowOrchestrateSkill(),
    ),
    scaffold(path.join(cwd, ".claude", "skills", "vow-audit", "SKILL.md"), vowAuditSkill()),
    ...promptTemplates().map((template) =>
      scaffold(path.join(cwd, template.path), template.content),
    ),
    installChannel(cwd),
  ];
  for (const action of actions) {
    process.stdout.write(`  ${action}\n`);
  }
  return 0;
}

/** `vow agent plan <n>` — print the self-contained, verification-gated plan an autonomous run develops for
 *  issue `n` (the executor's product), built from the scaffolded `plan.md` template (or its built-in default
 *  when absent). Reads the issue + HEAD; emits no side effects. */
function plan(cwd: string, issue: number): number {
  const spec = issueDetail(cwd, issue);
  const template = readPrompt(cwd, "plan");
  process.stdout.write(`${buildPlan(spec, { commit: headCommit(cwd), verify: [] }, template)}\n`);
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
    process.stdout.write(`${renderAuditPrompt(readPrompt(process.cwd(), "audit"), dimension)}\n`);
    return 0;
  }
  const file = flagValue(rest, "--file");
  if (file !== "") {
    return runAuditFile(file);
  }
  process.stderr.write("usage: vow agent audit (--prompt <dimension> | --file <findings.json>)\n");
  return 1;
}

/** One agent sub-command for the catalogue: its name, the argument hint shown in help, + a one-line
 *  summary. */
interface AgentSubcommand {
  readonly args: string;
  readonly name: string;
  readonly summary: string;
}

/**
 * The agent-native sub-command catalogue — every sub-command's name + summary, in display order, in ONE
 * place. This is the SINGLE source (mirroring `@vow/mcp`'s `tools.ts`): `agent` routes off it, the usage
 * line lists from it, and `cli.ts`'s `--help` derives its agent section from it via `agentHelp()` — so
 * the front door can't drift from the real sub-commands. A test guards that the routes match the catalogue.
 */
export const AGENT_SUBCOMMANDS: readonly AgentSubcommand[] = [
  {
    args: "",
    name: "init",
    summary:
      "scaffold the agent integration (AGENTS.md + develop/orchestrate/audit skills + prompts)",
  },
  { args: "<n>", name: "plan", summary: "print the verification-gated plan for issue <n>" },
  {
    args: "<n> [--dry-run]",
    name: "run",
    summary: "develop issue <n> + open a PR (--dry-run previews)",
  },
  { args: "<n>...", name: "run-all", summary: "develop multiple issues concurrently (a fleet)" },
  {
    args: "<pr>",
    name: "merge",
    summary: "merge a green PR / draft a red one (never off a red gate)",
  },
  {
    args: "--yes",
    name: "auto",
    summary: "the self-heal loop (needs --yes — audits + develops + merges unsupervised)",
  },
  {
    args: "--file <f.json>",
    name: "audit",
    summary: "file audit findings as vow issues (audit -> plan)",
  },
];

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

/** The names that route — every key of `SUBCOMMANDS`. A test asserts the catalogue covers exactly these,
 *  so a new sub-command without a help entry (or a help entry that no longer routes) fails the gate. */
export function agentRouteNames(): readonly string[] {
  return Object.keys(SUBCOMMANDS);
}

/** The `vow agent <name> [args]` invocation shown in help — the args are appended only when present. */
function invocationOf(sub: AgentSubcommand): string {
  return `vow agent ${sub.name} ${sub.args}`.trimEnd();
}

/** The `vow agent` block for the CLI `--help`, one indented line per sub-command, derived from the
 *  catalogue (so help can never drift from the real sub-commands). The summaries align on a column sized
 *  to the longest invocation. */
export function agentHelp(): string {
  const pad = Math.max(...AGENT_SUBCOMMANDS.map((sub) => invocationOf(sub).length));
  return AGENT_SUBCOMMANDS.map((sub) => `  ${invocationOf(sub).padEnd(pad)}  ${sub.summary}`).join(
    "\n",
  );
}

/** The `usage: vow agent <…>` line, listing the sub-command names from the catalogue. */
function agentUsage(): string {
  return `usage: vow agent <${AGENT_SUBCOMMANDS.map((sub) => sub.name).join("|")}>\n`;
}

/** True when help is requested — `--help`/`-h` anywhere, or `help` as the sub-command. Help is HELP: it
 *  prints usage and NEVER dispatches, so `vow agent auto --help` can't start the loop (#486). */
export function helpRequested(rest: readonly string[]): boolean {
  const [sub] = rest;
  return sub === "help" || rest.includes("--help") || rest.includes("-h");
}

/** `vow agent <sub>` — the agent-native front door: `init` (scaffold) · `plan <n>` (the executor-ready
 *  plan) · `run <n> [--dry-run]` (the live run / preview) · `run-all <n>...` (a fleet) · `merge <pr>` (merge
 *  a green PR / draft a red) · `auto --yes` (the self-heal loop) · `audit` (findings -> issues). A help
 *  request is intercepted BEFORE dispatch, so no `--help` probe can ever run a sub-command (#486). */
export function agent(rest: readonly string[]): number | Promise<number> {
  if (helpRequested(rest)) {
    process.stdout.write(`${agentUsage()}${agentHelp()}\n`);
    return 0;
  }
  const [sub] = rest;
  const handler = SUBCOMMANDS[sub ?? ""];
  if (handler) {
    return handler(rest);
  }
  process.stderr.write(agentUsage());
  return 1;
}
