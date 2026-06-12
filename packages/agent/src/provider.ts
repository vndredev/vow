/**
 * The provider seam — a coding CLI behind one interface. Claude Code today; Codex / Gemini are further
 * adapters over the same `Provider`. The command is built, never run here, so the mapping is pure +
 * testable and nothing above this layer names a provider (the seam the #107 gate guards).
 */

import type { Auth, Command, ModelPolicy, Provider } from "./types.ts";

/** The read-only tools a headless audit is allowed — it inspects the codebase and reports findings, never
 *  edits (the audit -> plan step files issues, not changes). Passed to `claude --allowedTools`. */
const AUDIT_TOOLS = "Read,Grep,Glob";

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

/**
 * Claude Code's per-role models — the clear Anthropic rule. Capability (knowledge) priority:
 * **Fable 5 > Opus 4.8 > Sonnet 4.6 > Haiku 4.5**. Each role gets a model by how much capability it
 * demands, top-down:
 *   - `audit`   — open-ended, whole-codebase bug-finding (the most knowledge) → **Fable 5**
 *   - `execute` — writes the complete, gate-green code for an issue           → **Opus 4.8**
 *   - `plan`    — structures one issue into its verification-gated plan        → **Sonnet 4.6**
 * Haiku is the floor — NEVER one of these roles: a cheap execute drafted a broken #502, so the role that
 * ships code must be capable. A native per-role setting (`VOW_*_MODEL`) can override per deployment, but
 * the default IS the rule.
 */
const CLAUDE_MODELS: ModelPolicy = {
  audit: modelSetting("VOW_AUDIT_MODEL", "claude-fable-5"),
  execute: modelSetting("VOW_EXECUTE_MODEL", "claude-opus-4-8"),
  plan: modelSetting("VOW_PLAN_MODEL", "claude-sonnet-4-6"),
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

/** The audit model — the brain a headless audit pass runs under (Fable, the most capable). Resolved from
 *  vow's native per-role setting, so it tracks the policy the loop already uses for the audit role. */
export const AUDIT_MODEL: string = CLAUDE_MODELS.audit;

/** The claude CLI command for a headless, read-only audit of one dimension: print mode at `model` with the
 *  audit prompt, restricted to read-only tools, and the API key stripped (subscription auth) unless `--auth
 *  api` is explicit. Built, never run here — the args array is the tested product (the LIVE shell-out is
 *  integration the CLI runs). Pure. */
export function auditCommand(model: string, prompt: string, auth?: Auth): Command {
  return {
    args: ["--model", model, "--print", "--allowedTools", AUDIT_TOOLS, prompt],
    bin: "claude",
    unsetEnv: authUnset(auth, "ANTHROPIC_API_KEY"),
  };
}

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

/** Friendly aliases for a provider's canonical name — the obvious short name a user/LLM reaches for (and
 *  the one the docs document) maps to the real backend, so `--provider claude` resolves `claude-code`. */
const PROVIDER_ALIASES: Readonly<Record<string, string>> = { claude: "claude-code" };

/** The provider named `name` (or its alias), or undefined when no backend matches. */
export function providerFor(name: string): Provider | undefined {
  const canonical = PROVIDER_ALIASES[name] ?? name;
  return PROVIDERS.find((provider) => provider.name === canonical);
}
