import { DEFAULT_PROVIDER, claudeCode, providerFor } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const task = {
  branch: "feat/issue-98",
  cwd: "/tmp/wt",
  plan: "Implement the thing. STOP if reality differs.",
  title: "the thing",
};

test("the Claude Code provider builds a headless `claude -p` command with the plan as the prompt", () => {
  const command = claudeCode.command(task);
  expect(command.bin).toBe("claude");
  expect(command.args).toContain("-p");
  expect(command.args).toContain(task.plan);
  expect(command.args).toContain("--permission-mode");
});

test("providerFor resolves a known provider by name, and nothing for an unknown one", () => {
  expect(providerFor(DEFAULT_PROVIDER)).toBe(claudeCode);
  expect(providerFor("nope")).toBeUndefined();
});

test("a provider never runs here — command() only builds the spec, twice over equally", () => {
  expect(claudeCode.command(task)).toEqual(claudeCode.command(task));
});
