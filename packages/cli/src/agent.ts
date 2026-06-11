import { agentsMd, vowDevelopSkill } from "./agent-templates.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

/** `vow agent <sub>` — the agent-native front door. Today: `init` (scaffold the integration). */
export function agent(rest: readonly string[]): number {
  const [sub] = rest;
  if (sub === "init") {
    return init(process.cwd());
  }
  process.stderr.write("usage: vow agent init\n");
  return 1;
}
