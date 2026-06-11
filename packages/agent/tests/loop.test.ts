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

test("runTask ties the loop: worktree → dispatch → verify → teardown, all green", async () => {
  const { calls, ops } = fakeOps(0);
  const outcome = await runTask({ context, cwd: "/wt", issue, ops, provider: claudeCode });
  expect(outcome.run.ok).toBe(true);
  expect(outcome.verdict.ok).toBe(true);
  expect(calls[0]).toBe("add /wt");
  expect(calls.at(-1)).toBe("remove /wt");
});

test("runTask tears the worktree down even when a gate fails", async () => {
  const { calls, ops } = fakeOps(1);
  const outcome = await runTask({ context, cwd: "/wt", issue, ops, provider: claudeCode });
  expect(outcome.verdict.ok).toBe(false);
  expect(calls.at(-1)).toBe("remove /wt");
});
