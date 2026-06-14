import { AUDIT_MODEL, auditCommand, claudeCode, codex, gemini, providerFor } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const task = { branch: "feat/issue-1", cwd: "/wt", plan: "do the thing", title: "t" };

test("providerFor resolves codex + gemini; each maps the plan to its headless CLI", () => {
  expect(providerFor("codex")).toBe(codex);
  expect(providerFor("gemini")).toBe(gemini);
  expect(providerFor("nope")).toBeUndefined();
  expect(codex.command(task).bin).toBe("codex");
  expect(codex.command(task).args).toContain("do the thing");
  expect(gemini.command(task).args).toContain("--yolo");
});

test("providerFor resolves the documented 'claude' alias to the claude-code backend", () => {
  // The docs document `--provider claude`; the canonical backend is `claude-code`.
  expect(providerFor("claude")).toBe(claudeCode);
  expect(providerFor("claude-code")).toBe(claudeCode);
});

test("auditCommand builds the read-only, print-mode claude args at the given model + prompt", () => {
  const command = auditCommand("claude-opus-4-8", "audit for types");
  expect(command.bin).toBe("claude");
  // Prompt is the positional right after `--print`; the variadic `--allowedTools <tools...>` comes LAST.
  // A trailing prompt would be swallowed as a tool, aborting claude with "Input must be provided".
  expect([...command.args]).toEqual([
    "--print",
    "audit for types",
    "--model",
    "claude-opus-4-8",
    "--allowedTools",
    "Read,Grep,Glob",
  ]);
  // The prompt sits before the variadic flag — guard the exact ordering the CLI bug needs.
  const args = [...command.args];
  expect(args.indexOf("audit for types")).toBeLessThan(args.indexOf("--allowedTools"));
  // Subscription auth by default — the API key is stripped from the child env.
  expect([...(command.unsetEnv ?? [])]).toEqual(["ANTHROPIC_API_KEY"]);
  // `--auth api` keeps the key (pay-per-use).
  expect(auditCommand("claude-opus-4-8", "p", "api").unsetEnv).toEqual([]);
});

test("AUDIT_MODEL defaults to Opus — the audit role's brain since Fable's suspension", () => {
  expect(AUDIT_MODEL).toBe("claude-opus-4-8");
});

test("claudeCode has a reviewCommand that builds a read-only print-mode command", () => {
  expect(claudeCode.reviewCommand).toBeDefined();
  const command = claudeCode.reviewCommand?.("claude-opus-4-8", "check the spec");
  expect(command?.bin).toBe("claude");
  expect(command?.args[0]).toBe("--print");
  expect([...(command?.args ?? [])]).toContain("check the spec");
  expect([...(command?.args ?? [])]).toContain("--allowedTools");
});

test("codex and gemini have no reviewCommand — the review is skipped for providers without headless mode", () => {
  expect(codex.reviewCommand).toBeUndefined();
  expect(gemini.reviewCommand).toBeUndefined();
});
