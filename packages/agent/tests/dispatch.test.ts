import { claudeCode, dispatch, worktreeAddArgs, worktreeRemoveArgs } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { AgentOps } from "../src/dispatch.ts";

const task = { branch: "vow/issue-98", cwd: "/tmp/wt", plan: "do it", title: "the loop" };

/** A fake ops that records its calls + returns a scripted run result — so no git is touched and `claude`
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

test("dispatch sets up the worktree, runs the provider in it, then tears it down", async () => {
  const { calls, ops } = fakeOps(0);
  const result = await dispatch(task, claudeCode, ops);
  expect(result.ok).toBe(true);
  expect(calls).toEqual(["add vow/issue-98 at /tmp/wt", "run claude in /tmp/wt", "remove /tmp/wt"]);
});

test("dispatch tears the worktree down even when the run fails", async () => {
  const { calls, ops } = fakeOps(1);
  const result = await dispatch(task, claudeCode, ops);
  expect(result.ok).toBe(false);
  expect(calls.at(-1)).toBe("remove /tmp/wt");
});

test("the git worktree args are isolation-correct (fresh branch, forced teardown)", () => {
  expect(worktreeAddArgs("/tmp/wt", "vow/issue-98")).toEqual([
    "worktree",
    "add",
    "-b",
    "vow/issue-98",
    "/tmp/wt",
  ]);
  expect(worktreeRemoveArgs("/tmp/wt")).toContain("--force");
});
