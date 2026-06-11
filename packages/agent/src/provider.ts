/**
 * The provider seam — a coding CLI behind one interface. Claude Code today; Codex / Gemini are further
 * adapters over the same `Provider`. The command is built, never run here, so the mapping is pure +
 * testable and nothing above this layer names a provider (the seam the #107 gate guards).
 */

import type { Auth, ModelPolicy, Provider } from "./types.ts";

/** A `<flag> <model>` pair when the task pins a model, else nothing — each provider passes its OWN flag
 *  name, so the model axis stays provider-neutral (the provider says WHICH CLI, the model WHICH BRAIN). */
function modelFlag(flag: string, model: string): readonly string[] {
  if (model === "") {
    return [];
  }
  return [flag, model];
}

/** The env vars to UNSET so the provider authenticates via its SUBSCRIPTION, not a pay-per-use API key —
 *  stripped unless `--auth api` is explicit (subscription is the safe default). Each provider names its
 *  own key env, so the choice stays provider-neutral. */
function authUnset(auth: Auth | undefined, apiKeyEnv: string): readonly string[] {
  if (auth === "api") {
    return [];
  }
  return [apiKeyEnv];
}

/** A provider's default policy — no model override per role; the CLI picks its own brain. */
const PROVIDER_DEFAULT: ModelPolicy = { audit: "", execute: "", plan: "" };

/** A per-role model from the native vow setting (an env var), or the default — so the model is configured
 *  IN vow, not hard-coded; override per deployment without a code change. */
function modelSetting(envKey: string, fallback: string): string {
  // oxlint-disable-next-line no-process-env -- the native per-role model setting (VOW_*_MODEL), defaulted
  return process.env[envKey] ?? fallback;
}

/** Claude Code's per-role models — native vow settings defaulting to Fable (the most capable, for the
 *  hardest + longest-running roles) for audit + plan, and a cheap Haiku for the bulk execute role. */
const CLAUDE_MODELS: ModelPolicy = {
  audit: modelSetting("VOW_AUDIT_MODEL", "claude-fable-5"),
  execute: modelSetting("VOW_EXECUTE_MODEL", "claude-haiku-4-5"),
  plan: modelSetting("VOW_PLAN_MODEL", "claude-fable-5"),
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
    unsetEnv: authUnset(task.auth, "ANTHROPIC_API_KEY"),
  }),
  models: CLAUDE_MODELS,
  name: "claude-code",
};

/** Codex CLI — `codex exec` non-interactive, `--full-auto` so edits apply without a prompt. */
export const codex: Provider = {
  command: (task) => ({
    args: ["exec", "--full-auto", ...modelFlag("--model", task.model ?? ""), task.plan],
    bin: "codex",
    unsetEnv: authUnset(task.auth, "OPENAI_API_KEY"),
  }),
  models: PROVIDER_DEFAULT,
  name: "codex",
};

/** Gemini CLI — `gemini -p` headless, `--yolo` to apply edits without confirmation. */
export const gemini: Provider = {
  command: (task) => ({
    args: ["-p", task.plan, "--yolo", ...modelFlag("--model", task.model ?? "")],
    bin: "gemini",
    unsetEnv: authUnset(task.auth, "GEMINI_API_KEY"),
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
