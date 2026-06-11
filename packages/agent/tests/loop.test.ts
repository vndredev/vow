import { claudeCode, runTask } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { AgentOps } from "../src/types.ts";

const issue = { body: "do the thing", number: 98, title: "the loop" };
const context = { commit: "abc1234", verify: ["vp check"] };

/** A fake ops: records the worktree + run lifecycle; the provider (`claude`) exits 0, the verify gate
 *  exits `gateCode`. No git is touched and `claude` never runs. */
function fakeOps(gateCode: number, runCode = 0): { calls: string[]; ops: AgentOps } {
  const calls: string[] = [];
  const ops: AgentOps = {
    run: async (command) => {
      await Promise.resolve();
      calls.push(`run ${command.bin}`);
      if (command.bin === "claude") {
        return { code: runCode, output: "ok" };
      }
      return { code: gateCode, output: "" };
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
      if (command.bin === "claude") {
        return { code: 1, output: "boom" };
      }
      return { code: 0, output: "" };
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

test("a successful run is published — pushed + a PR opened before the worktree is torn down", async () => {
  const { calls, ops } = fakeOps(0);
  await runTask({ context, cwd: "/repo", issue, ops, provider: claudeCode });
  expect(calls).toContain("run gh");
  expect(calls.lastIndexOf("run gh")).toBeLessThan(calls.indexOf(`remove ${WORKTREE}`));
});

test("a failed provider run is NOT published — no PR for work that never happened", async () => {
  const { calls, ops } = fakeOps(0, 1);
  await runTask({ context, cwd: "/repo", issue, ops, provider: claudeCode });
  expect(calls).not.toContain("run gh");
});
