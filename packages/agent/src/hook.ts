/**
 * The provider-neutral tool-call guardrail — the LLM HOOK's brain. A coding agent (Claude Code, Codex,
 * Gemini) about to run a tool hits its provider's pre-tool hook, which shells `vow hook <provider>`; this
 * decides ALLOW or DENY and, on DENY, returns the LLM-friendly reason naming the right vow path. So a wrong
 * action — a raw `gh pr create`, a direct push to main, `vp check --fix` — is BLOCKED in the moment with the
 * correction, not caught later by a red CI gate, and not left to a memory the next user's LLM never read.
 *
 * The rules + the verdict are provider-NEUTRAL (one engine for every provider). Each provider's hook
 * input/output JSON is a thin adapter; the Claude Code adapter lives here, the next ones join beside it.
 */

/** A tool call an agent is about to run — the tool's name and, for a shell tool, its command line. */
export interface ToolCall {
  readonly command: string;
  readonly tool: string;
}

/** The guardrail's verdict — allow the call, or deny it with the LLM-friendly correction. */
export type HookVerdict =
  | { readonly decision: "allow" }
  | { readonly decision: "deny"; readonly reason: string };

/** One guardrail rule — a command pattern that is the WRONG path, and the vow path to take instead. */
interface HookRule {
  readonly match: RegExp;
  readonly reason: string;
}

/** The rules — each blocks a forceable mistake and names vow's own tool. The mechanical form of AGENTS.md's
    "work through vow", enforced at the moment of action so no LLM (this user's or the next's) can skip it. */
const RULES: readonly HookRule[] = [
  {
    match: /\bgit\s+push\b[^|&;]*\bmain\b/u,
    reason:
      "main is PR-only — no direct push. Branch as `<type>/<slug>`, open a PR; the agent merges when CI's gate is green.",
  },
  {
    match: /\bgh\s+issue\s+create\b/u,
    reason:
      "Don't file issues with raw gh — use the vow `add_issue` MCP tool. It fills the bug/feature template + phase + labels, so the issue-template gate passes.",
  },
  {
    match: /\bgh\s+pr\s+merge\b/u,
    reason:
      "Don't merge with raw gh — use `vow agent merge <pr>`. It merges only on a green CI gate and syncs the board 1:1.",
  },
  {
    match: /\bvp\s+check\s+--fix\b/u,
    reason:
      "Never `vp check --fix` — it corrupts files. Use `vp fmt` to format, then `vp check` to verify.",
  },
];

/** The guardrail decision for one tool call — DENY the first rule it trips (with the correction), else ALLOW.
    Only a shell tool carries a command to guard; any other tool is allowed. Pure. */
export function checkToolCall(call: Readonly<ToolCall>): HookVerdict {
  if (call.tool !== "Bash") {
    return { decision: "allow" };
  }
  for (const rule of RULES) {
    if (rule.match.test(call.command)) {
      return { decision: "deny", reason: rule.reason };
    }
  }
  return { decision: "allow" };
}

/** Whether a value is a non-null object — to read an external hook payload's fields without an unsafe cast. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A string field off an untrusted record, or "" when absent / not a string. Defensive: the hook payload is
    external JSON. */
function strAt(obj: unknown, key: string): string {
  if (isRecord(obj)) {
    const value = obj[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

/** The `ToolCall` a Claude Code PreToolUse payload describes — `tool_name` + (for Bash) `tool_input.command`,
    read defensively so a malformed payload guards as an empty (allowed) call rather than throwing. Pure. */
export function claudeToolCall(raw: unknown): ToolCall {
  const tool = strAt(raw, "tool_name");
  if (isRecord(raw)) {
    return { command: strAt(raw["tool_input"], "command"), tool };
  }
  return { command: "", tool };
}

/** Claude Code's PreToolUse stdout that DENIES a tool call with a reason the model reads + self-corrects on.
    An allow prints nothing (the CLI emits this only on deny) → normal permission flow. */
export interface ClaudeHookOutput {
  readonly hookSpecificOutput: {
    readonly hookEventName: "PreToolUse";
    readonly permissionDecision: "deny";
    readonly permissionDecisionReason: string;
  };
}

/** Format a deny `reason` as Claude Code's PreToolUse `hookSpecificOutput`. Pure; the CLI prints it as JSON. */
export function claudeDenyOutput(reason: string): ClaudeHookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

/** Claude Code's SessionStart stdout that INJECTS context into the new session — its `additionalContext` is
    prepended to the model's first turn (startup / clear / compact). The session-start envelope, beside the
    PreToolUse one: the harness-specific shape lives here, the bootstrap TEXT stays neutral (`bootstrap.ts`). */
export interface ClaudeSessionStartOutput {
  readonly hookSpecificOutput: {
    readonly additionalContext: string;
    readonly hookEventName: "SessionStart";
  };
}

/** Wrap the provider-neutral `bootstrap` as Claude Code's SessionStart `hookSpecificOutput`. Pure; the CLI
    prints it as JSON + exits 0, so the harness injects the bootstrap as the session's first context. A second
    harness is a new wrapper over the SAME `bootstrap` string, never a rewrite (vow's provider-neutral way). */
export function sessionStartOutput(bootstrap: string): ClaudeSessionStartOutput {
  return {
    hookSpecificOutput: {
      additionalContext: bootstrap,
      hookEventName: "SessionStart",
    },
  };
}
