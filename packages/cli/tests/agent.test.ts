import { expect, test } from "vite-plus/test";
import { issueArg } from "../src/agent.ts";

const ISSUE = 42;

test("issueArg reads a positive issue number, else 0 for a missing/non-numeric/non-positive arg", () => {
  expect(issueArg(["plan", String(ISSUE)])).toBe(ISSUE);
  expect(issueArg(["plan"])).toBe(0);
  expect(issueArg(["plan", "abc"])).toBe(0);
  expect(issueArg(["plan", "-3"])).toBe(0);
  expect(issueArg(["plan", "5.5"])).toBe(0);
});
