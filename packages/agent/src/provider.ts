/**
 * The provider seam — a coding CLI behind one interface. Claude Code today; Codex / Gemini are further
 * adapters over the same `Provider`. The command is built, never run here, so the mapping is pure +
 * testable and nothing above this layer names a provider (the seam the #107 gate guards).
 */

import type { Provider } from "./types.ts";

/** Claude Code — `claude -p` headless: print mode, edits accepted, structured output. The plan is the
 *  prompt; the runner sets the cwd to the task's worktree. */
export const claudeCode: Provider = {
  command: (task) => ({
    args: ["-p", task.plan, "--permission-mode", "acceptEdits", "--output-format", "json"],
    bin: "claude",
  }),
  name: "claude-code",
};

/** Codex CLI — `codex exec` non-interactive, `--full-auto` so edits apply without a prompt. */
export const codex: Provider = {
  command: (task) => ({
    args: ["exec", "--full-auto", task.plan],
    bin: "codex",
  }),
  name: "codex",
};

/** Gemini CLI — `gemini -p` headless, `--yolo` to apply edits without confirmation. */
export const gemini: Provider = {
  command: (task) => ({
    args: ["-p", task.plan, "--yolo"],
    bin: "gemini",
  }),
  name: "gemini",
};

/** Every known provider — the loop above names none of them; it runs whichever `Provider` it is handed. */
export const PROVIDERS: readonly Provider[] = [claudeCode, codex, gemini];

/** The default provider's name — used when a task doesn't pin one. */
export const DEFAULT_PROVIDER = "claude-code";

/** The provider named `name`, or undefined when no backend matches. */
export function providerFor(name: string): Provider | undefined {
  return PROVIDERS.find((provider) => provider.name === name);
}
