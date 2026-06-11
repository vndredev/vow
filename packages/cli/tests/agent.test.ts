import { expect, test } from "vite-plus/test";
import { flagValue, issueArg } from "../src/agent.ts";

const ISSUE = 42;

test("issueArg reads a positive issue number, else 0 for a missing/non-numeric/non-positive arg", () => {
  expect(issueArg(["plan", String(ISSUE)])).toBe(ISSUE);
  expect(issueArg(["plan"])).toBe(0);
  expect(issueArg(["plan", "abc"])).toBe(0);
  expect(issueArg(["plan", "-3"])).toBe(0);
  expect(issueArg(["plan", "5.5"])).toBe(0);
});

test("flagValue reads the value after a flag, else empty for a missing flag or a trailing flag", () => {
  expect(flagValue(["run", "5", "--provider", "codex"], "--provider")).toBe("codex");
  expect(flagValue(["run", "5", "--dry-run"], "--provider")).toBe("");
  expect(flagValue(["run", "5", "--provider"], "--provider")).toBe("");
});
