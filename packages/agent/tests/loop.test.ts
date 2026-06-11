import { claudeCode, runTask } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { AgentOps } from "../src/types.ts";

const issue = { body: "do the thing", number: 98, title: "the loop" };
const context = { commit: "abc1234", verify: ["vp check"] };

/** A fake ops: records the worktree + run lifecycle; the provider exits 0, the verify gate (`sh`) exits
 *  `shCode`. No git is touched and `claude` never runs. */
function fakeOps(shCode: number): { calls: string[]; ops: AgentOps } {
  const calls: string[] = [];
  const ops: AgentOps = {
    run: async (command) => {
      await Promise.resolve();
      calls.push(`run ${command.bin}`);
      if (command.bin === "sh") {
        return { code: shCode, output: "" };
      }
      return { code: 0, output: "ok" };
    },
    worktreeAdd: async (path) => {
      await Promise.resolve();
      calls.push(`add ${path}`);
    },
    worktreeRemove: async (path) => {
      await Promise.resolve();
      calls.push(`remove ${path}`);
    },
  };
  return { calls, ops };
}

/** The expected worktree for issue 98 — under the repo's worktrees dir, distinct from the repo root. */
const WORKTREE = "/repo/.vow-worktrees/vow-issue-98";

test("runTask isolates the work in a worktree distinct from the repo, and always tears it down", async () => {
  const { calls, ops } = fakeOps(0);
  const outcome = await runTask({ context, cwd: "/repo", issue, ops, provider: claudeCode });
  expect(outcome.run.ok).toBe(true);
  expect(outcome.verdict.ok).toBe(true);
  expect(calls[0]).toBe(`add ${WORKTREE}`);
  expect(calls[0]).not.toBe("add /repo");
  expect(calls.at(-1)).toBe(`remove ${WORKTREE}`);
});

test("runTask tears the worktree down even when a gate fails", async () => {
  const { calls, ops } = fakeOps(1);
  const outcome = await runTask({ context, cwd: "/repo", issue, ops, provider: claudeCode });
  expect(outcome.verdict.ok).toBe(false);
  expect(calls.at(-1)).toBe(`remove ${WORKTREE}`);
});

test("a failed provider run yields run.ok=false — the draft-PR trigger", async () => {
  const ops: AgentOps = {
    run: async (command) => {
      await Promise.resolve();
      if (command.bin === "sh") {
        return { code: 0, output: "" };
      }
      return { code: 1, output: "boom" };
    },
    worktreeAdd: async () => {
      await Promise.resolve();
    },
    worktreeRemove: async () => {
      await Promise.resolve();
    },
  };
  const outcome = await runTask({ context, cwd: "/repo", issue, ops, provider: claudeCode });
  expect(outcome.run.ok).toBe(false);
});
