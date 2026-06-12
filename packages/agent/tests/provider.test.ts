import { AUDIT_MODEL, auditCommand, codex, gemini, providerFor } from "../src/index.ts";
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

test("auditCommand builds the read-only, print-mode claude args at the given model + prompt", () => {
  const command = auditCommand("claude-fable-5", "audit for types");
  expect(command.bin).toBe("claude");
  expect([...command.args]).toEqual([
    "--model",
    "claude-fable-5",
    "--print",
    "--allowedTools",
    "Read,Grep,Glob",
    "audit for types",
  ]);
  // Subscription auth by default — the API key is stripped from the child env.
  expect([...(command.unsetEnv ?? [])]).toEqual(["ANTHROPIC_API_KEY"]);
  // `--auth api` keeps the key (pay-per-use).
  expect(auditCommand("claude-fable-5", "p", "api").unsetEnv).toEqual([]);
});

test("AUDIT_MODEL defaults to Fable — the audit role's brain", () => {
  expect(typeof AUDIT_MODEL).toBe("string");
  expect(AUDIT_MODEL).not.toBe("");
});
