/**
 * The agent layer — provider-neutral orchestration of an autonomous coding CLI. vow describes a task; a
 * `Provider` (Claude Code today; Codex / Gemini as further adapters over this one interface) turns it into
 * the headless command that develops it. The command is *built*, never run here — a runner execs it — so
 * the mapping is unit-testable and the loop above never names a provider. This is the seam the
 * provider-neutrality gate (#107) guards: nothing above this layer may hardcode a CLI.
 */

export * from "./plan.ts";

/** A task for an autonomous coding agent: develop `plan` in `cwd`, on its own `branch`. */
export interface AgentTask {
  readonly branch: string;
  readonly cwd: string;
  readonly plan: string;
  readonly title: string;
}

/** A command to spawn — what to exec, built but never run here (so the mapping stays pure + testable). */
export interface Command {
  readonly args: readonly string[];
  readonly bin: string;
}

/** A coding-CLI provider — the one seam every agent backend implements. The loop holds a `Provider`,
 *  never a provider name. */
export interface Provider {
  /** The headless command that autonomously develops `task` in its worktree. */
  readonly command: (task: AgentTask) => Command;
  readonly name: string;
}

/** Claude Code — `claude -p` headless: print mode, edits accepted, structured output. The plan is the
 *  prompt; the runner sets the cwd to the task's worktree. */
export const claudeCode: Provider = {
  command: (task) => ({
    args: ["-p", task.plan, "--permission-mode", "acceptEdits", "--output-format", "json"],
    bin: "claude",
  }),
  name: "claude-code",
};

/** Every known provider. Codex + Gemini join here as adapters over `Provider`; the loop above is unchanged. */
export const PROVIDERS: readonly Provider[] = [claudeCode];

/** The default provider's name — used when a task doesn't pin one. */
export const DEFAULT_PROVIDER = "claude-code";

/** The provider named `name`, or undefined when no backend matches. */
export function providerFor(name: string): Provider | undefined {
  return PROVIDERS.find((provider) => provider.name === name);
}
