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
  const command = auditCommand("claude-fable-5", "audit for types");
  expect(command.bin).toBe("claude");
  // Prompt is the positional right after `--print`; the variadic `--allowedTools <tools...>` comes LAST.
  // A trailing prompt would be swallowed as a tool, aborting claude with "Input must be provided".
  expect([...command.args]).toEqual([
    "--print",
    "audit for types",
    "--model",
    "claude-fable-5",
    "--allowedTools",
    "Read,Grep,Glob",
  ]);
  // The prompt sits before the variadic flag — guard the exact ordering the CLI bug needs.
  const args = [...command.args];
  expect(args.indexOf("audit for types")).toBeLessThan(args.indexOf("--allowedTools"));
  // Subscription auth by default — the API key is stripped from the child env.
  expect([...(command.unsetEnv ?? [])]).toEqual(["ANTHROPIC_API_KEY"]);
  // `--auth api` keeps the key (pay-per-use).
  expect(auditCommand("claude-fable-5", "p", "api").unsetEnv).toEqual([]);
});

test("AUDIT_MODEL defaults to Fable — the audit role's brain", () => {
  expect(typeof AUDIT_MODEL).toBe("string");
  expect(AUDIT_MODEL).not.toBe("");
});
