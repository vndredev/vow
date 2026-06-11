import {
  claudeCode,
  dispatch,
  gateCommand,
  worktreeAddArgs,
  worktreeRemoveArgs,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { AgentOps } from "../src/types.ts";

const task = { branch: "feat/issue-98", cwd: "/tmp/wt", plan: "do it", title: "the loop" };

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
