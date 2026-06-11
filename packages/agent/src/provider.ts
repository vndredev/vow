/**
 * The provider seam — a coding CLI behind one interface. Claude Code today; Codex / Gemini are further
 * adapters over the same `Provider`. The command is built, never run here, so the mapping is pure +
 * testable and nothing above this layer names a provider (the seam the #107 gate guards).
 */

import type { ModelPolicy, Provider } from "./types.ts";

/** A `<flag> <model>` pair when the task pins a model, else nothing — each provider passes its OWN flag
 *  name, so the model axis stays provider-neutral (the provider says WHICH CLI, the model WHICH BRAIN). */
function modelFlag(flag: string, model: string): readonly string[] {
  if (model === "") {
    return [];
  }
  return [flag, model];
}

/** A provider's default policy — no model override per role; the CLI picks its own brain. */
const PROVIDER_DEFAULT: ModelPolicy = { audit: "", execute: "", plan: "" };

/** Claude Code's per-role models — a capable model plans + audits, a cheaper one executes the gated,
 *  drift-proof plan (swap for the best of the day). Codex / Gemini stay on their own default until tuned. */
const CLAUDE_MODELS: ModelPolicy = {
  audit: "claude-opus-4-8",
  execute: "claude-haiku-4-5",
  plan: "claude-opus-4-8",
};

/** Claude Code — `claude -p` headless: print mode, edits accepted, structured output. The plan is the
 *  prompt; the runner sets the cwd to the task's worktree. */
export const claudeCode: Provider = {
  command: (task) => ({
    args: [
      "-p",
      task.plan,
      "--permission-mode",
      "acceptEdits",
      "--output-format",
      "json",
      ...modelFlag("--model", task.model ?? ""),
    ],
    bin: "claude",
  }),
  models: CLAUDE_MODELS,
  name: "claude-code",
};

/** Codex CLI — `codex exec` non-interactive, `--full-auto` so edits apply without a prompt. */
export const codex: Provider = {
  command: (task) => ({
    args: ["exec", "--full-auto", ...modelFlag("--model", task.model ?? ""), task.plan],
    bin: "codex",
  }),
  models: PROVIDER_DEFAULT,
  name: "codex",
};

/** Gemini CLI — `gemini -p` headless, `--yolo` to apply edits without confirmation. */
export const gemini: Provider = {
  command: (task) => ({
    args: ["-p", task.plan, "--yolo", ...modelFlag("--model", task.model ?? "")],
    bin: "gemini",
  }),
  models: PROVIDER_DEFAULT,
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
