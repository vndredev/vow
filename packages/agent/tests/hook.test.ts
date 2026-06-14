import {
  checkToolCall,
  claudeDenyOutput,
  claudeToolCall,
  sessionBootstrap,
  sessionStartOutput,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("checkToolCall blocks each wrong tool-call with the vow alternative", () => {
  const push = checkToolCall({ command: "git push origin main", tool: "Bash" });
  expect(push.decision).toBe("deny");
  if (push.decision === "deny") {
    expect(push.reason).toContain("PR-only");
  }
  expect(checkToolCall({ command: "gh issue create --title x", tool: "Bash" }).decision).toBe(
    "deny",
  );
  expect(checkToolCall({ command: "gh pr merge 5", tool: "Bash" }).decision).toBe("deny");
  expect(checkToolCall({ command: "vp check --fix", tool: "Bash" }).decision).toBe("deny");
});

test("checkToolCall allows a safe command + any non-Bash tool (no false block)", () => {
  expect(checkToolCall({ command: "git push -u origin feat/x", tool: "Bash" }).decision).toBe(
    "allow",
  );
  expect(checkToolCall({ command: "vp check", tool: "Bash" }).decision).toBe("allow");
  expect(checkToolCall({ command: "vp fmt", tool: "Bash" }).decision).toBe("allow");
  // A different tool carries no command to guard.
  expect(checkToolCall({ command: "gh pr create", tool: "Read" }).decision).toBe("allow");
  // "maintenance" is not the whole word "main" — the push guard does not fire.
  expect(checkToolCall({ command: "git push origin maintenance", tool: "Bash" }).decision).toBe(
    "allow",
  );
});

test("claudeToolCall reads tool_name + tool_input.command, defensively on a bad payload", () => {
  const payload: unknown = JSON.parse(
    '{"tool_name":"Bash","tool_input":{"command":"git push origin main"}}',
  );
  expect(claudeToolCall(payload)).toEqual({ command: "git push origin main", tool: "Bash" });
  // A non-object payload guards as an empty (allowed) call, never throws.
  expect(claudeToolCall("")).toEqual({ command: "", tool: "" });
  // A missing tool_input → empty command, the tool still read.
  expect(claudeToolCall(JSON.parse('{"tool_name":"Bash"}'))).toEqual({ command: "", tool: "Bash" });
});

test("claudeDenyOutput formats Claude Code's PreToolUse deny JSON", () => {
  const out = claudeDenyOutput("use vow agent merge");
  expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(out.hookSpecificOutput.permissionDecisionReason).toBe("use vow agent merge");
});

test("the using-vow bootstrap carries the consult-first rule + the red line", () => {
  const text = sessionBootstrap();
  // The RULE: consult a discipline/skill before acting, even before clarifying questions.
  expect(text).toContain("CONSULT it BEFORE acting");
  expect(text).toContain("clarifying questions");
  // The red line — the gated sequence every change runs.
  for (const step of ["The red line", "Branch", "Verify", "PR", "Merge"]) {
    expect(text).toContain(step);
  }
});

test("the using-vow bootstrap NAMES the gates + surfaces the team and skill library", () => {
  const text = sessionBootstrap();
  // It NAMES the gates that block drift.
  for (const gate of [
    "quality wall",
    "framework-neutrality",
    "provider-neutrality",
    "design-language",
  ]) {
    expect(text).toContain(gate);
  }
  // The team + the skill library are surfaced as where the techniques live.
  expect(text).toContain("vow-developer");
  expect(text).toContain("skill library");
});

test("the using-vow bootstrap is provider-neutral — it names no provider CLI bin", () => {
  // The bootstrap TEXT is shared by every harness; a provider bin name belongs only at the seam.
  const text = sessionBootstrap().toLowerCase();
  expect(text).not.toContain("claude code");
  expect(text).not.toContain("codex");
  expect(text).not.toContain("gemini");
});

test("sessionBootstrap is pure — every call returns the same text (no IO, no provider)", () => {
  expect(sessionBootstrap()).toBe(sessionBootstrap());
});

test("sessionStartOutput wraps the bootstrap as Claude Code's SessionStart additionalContext", () => {
  const bootstrap = sessionBootstrap();
  const out = sessionStartOutput(bootstrap);
  expect(out.hookSpecificOutput.hookEventName).toBe("SessionStart");
  // The injection IS the bootstrap, verbatim — the envelope adds shape, never edits the text.
  expect(out.hookSpecificOutput.additionalContext).toBe(bootstrap);
});
