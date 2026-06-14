import {
  claudeCode,
  dispatch,
  gateCommand,
  staleWorktrees,
  worktreeAddArgs,
  worktreeIssue,
  worktreeRemoveArgs,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { AgentOps } from "../src/types.ts";

const task = { branch: "feat/issue-98", cwd: "/tmp/wt", plan: "do it", title: "the loop" };

// Illustrative issue numbers for the worktree-staleness tests (any distinct positive ids work).
const ISSUE_98 = 98;
const ISSUE_231 = 231;
const ACTIVE = 10;
const STALE = 11;

/** A fake ops that records its calls + scripts the run's exit code — so no git is touched and `claude`
 *  never runs. */
function fakeOps(code: number): { calls: string[]; ops: AgentOps } {
  const calls: string[] = [];
  const ops: AgentOps = {
    run: async (command, cwd) => {
      await Promise.resolve();
      calls.push(`run ${command.bin} in ${cwd}`);
      return { code, output: "done" };
    },
    worktreeAdd: async (path, branch) => {
      await Promise.resolve();
      calls.push(`add ${branch} at ${path}`);
    },
    worktreeRemove: async (path) => {
      await Promise.resolve();
      calls.push(`remove ${path}`);
    },
  };
  return { calls, ops };
}

test("dispatch runs the provider in the task's cwd and reports ok on exit 0", async () => {
  const { calls, ops } = fakeOps(0);
  const result = await dispatch(task, claudeCode, ops);
  expect(result.ok).toBe(true);
  expect(calls).toEqual(["run claude in /tmp/wt"]);
});

test("dispatch reports not-ok when the provider exits non-zero", async () => {
  const { ops } = fakeOps(1);
  const result = await dispatch(task, claudeCode, ops);
  expect(result.ok).toBe(false);
});

test("the git worktree args are isolation-correct (fresh branch, forced teardown)", () => {
  expect(worktreeAddArgs("/tmp/wt", "feat/issue-98")).toEqual([
    "worktree",
    "add",
    "-B",
    "feat/issue-98",
    "/tmp/wt",
  ]);
  expect(worktreeRemoveArgs("/tmp/wt")).toContain("--force");
});

test("gateCommand splits a gate string into argv — no sh -c eval sink", () => {
  expect(gateCommand("pnpm -r test")).toEqual({ args: ["-r", "test"], bin: "pnpm" });
  expect(gateCommand("vp check")).toEqual({ args: ["check"], bin: "vp" });
});

test("worktreeIssue maps a per-issue worktree dir to its issue, 0 for anything else (#681)", () => {
  expect(worktreeIssue(`feat-issue-${ISSUE_98}`)).toBe(ISSUE_98);
  expect(worktreeIssue(`feat-issue-${ISSUE_231}`)).toBe(ISSUE_231);
  // A non per-issue dir (a stray, an unrelated branch worktree) is NOT a per-issue worktree.
  expect(worktreeIssue("scratch")).toBe(0);
  expect(worktreeIssue("fix-issue-7")).toBe(0);
  expect(worktreeIssue("feat-issue-")).toBe(0);
});

test("staleWorktrees removes a leftover but SPARES an active one (and ignores stray dirs) (#681)", () => {
  const dirs = [`feat-issue-${ACTIVE}`, `feat-issue-${STALE}`, "scratch"];
  // ACTIVE is active (an in-flight run owns it) -> spared; STALE is a leftover; `scratch` is not ours.
  expect(staleWorktrees(dirs, [ACTIVE])).toEqual([`feat-issue-${STALE}`]);
  // With nothing active, every per-issue leftover is stale; the stray dir is still left untouched.
  expect(staleWorktrees(dirs, [])).toEqual([`feat-issue-${ACTIVE}`, `feat-issue-${STALE}`]);
  // No dirs -> nothing to remove.
  expect(staleWorktrees([], [ACTIVE])).toEqual([]);
});
