import { claudeCode, codex, dryRunReport } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const NUM = 42;
const ISSUE = { body: "do the thing", number: NUM, title: "Add a widget" };

test("dryRunReport previews the claude-code command with the inlined plan elided", () => {
  const report = dryRunReport(ISSUE, claudeCode);
  expect(report).toContain(`#${NUM} Add a widget`);
  expect(report).toContain("provider: claude-code");
  expect(report).toContain(`branch:   feat/issue-${NUM}`);
  expect(report).toContain("command:  claude -p <plan> --permission-mode acceptEdits");
  // The local final verify is worktree-safe (`vp check` + the touched package); CI runs the full suite (#685).
  expect(report).toContain("vp check · the touched package's tests");
  expect(report).toContain("CI runs the full pnpm -r test");
});

test("dryRunReport swaps the command per provider (codex)", () => {
  expect(dryRunReport(ISSUE, codex)).toContain("command:  codex exec --full-auto <plan>");
});
