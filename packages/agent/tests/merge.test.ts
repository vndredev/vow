import { draftArgs, mergeArgs, mergeDecision } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const PR = 42;

test("mergeDecision merges a green run, drafts a red run, waits while pending", () => {
  expect(mergeDecision("pass")).toBe("merge");
  expect(mergeDecision("fail")).toBe("draft");
  expect(mergeDecision("pending")).toBe("wait");
});

test("the merge + draft args target the PR (squash + delete on merge, undo on draft)", () => {
  expect(mergeArgs(PR)).toEqual(["pr", "merge", "42", "--squash", "--delete-branch"]);
  expect(draftArgs(PR)).toContain("--undo");
});

test("a non-empty matchHead pins the merge to that SHA, empty leaves it unpinned", () => {
  const pinned = mergeArgs(PR, "abc");
  expect(pinned).toContain("--match-head-commit");
  expect(pinned).toContain("abc");
  expect(mergeArgs(PR)).not.toContain("--match-head-commit");
});
