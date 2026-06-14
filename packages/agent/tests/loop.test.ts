import type { AgentOps, Provider } from "../src/types.ts";
import { claudeCode, codex, runTask } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const issue = { body: "do the thing", number: 98, title: "the loop" };
const context = { commit: "abc1234", verify: ["vp check"] };

/** JSON the fake review run emits — compliant so the review loop exits on the first pass. */
const REVIEW_OK = JSON.stringify({ compliant: true, feedback: "" });

/** A fake ops: records the worktree + run lifecycle. The provider run (claude `-p`) exits `runCode`;
 *  the spec-review run (claude `--print`) always emits a compliant result so the review loop exits
 *  on the first pass; all other commands (vp, git, gh) exit `gateCode`. */
function fakeOps(gateCode: number, runCode = 0): { calls: string[]; ops: AgentOps } {
  const calls: string[] = [];
  const ops: AgentOps = {
    run: async (command) => {
      await Promise.resolve();
      calls.push(`run ${command.bin}`);
      if (command.bin === "claude" && command.args[0] === "--print") {
        return { code: 0, output: REVIEW_OK };
      }
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
const WORKTREE = "/repo/.vow-worktrees/feat-issue-98";

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

test("runTask does NOT tear down a worktree its own add never created (a failed add owns the path)", async () => {
  // A failed `worktreeAdd` means THIS task did not establish the worktree — the path may belong to a SIBLING
  // Lane (a duplicate run-all arg / a collision). Tearing it down here would force-remove the owner's live
  // Worktree and fail both. So a failed add MUST skip `worktreeRemove`; `realOps.worktreeAdd` itself cleans
  // Up any partial materialization it owns (git-add succeeded, install failed) before it re-throws.
  const calls: string[] = [];
  const ops: AgentOps = {
    run: async () => {
      await Promise.resolve();
      return { code: 0, output: "" };
    },
    worktreeAdd: async (path) => {
      await Promise.resolve();
      calls.push(`add ${path}`);
      throw new Error("git worktree add failed (path exists)");
    },
    worktreeRemove: async (path) => {
      await Promise.resolve();
      calls.push(`remove ${path}`);
    },
  };
  await expect(
    runTask({ context, cwd: "/repo", issue, ops, provider: claudeCode }),
  ).rejects.toThrow("git worktree add failed (path exists)");
  expect(calls).toContain(`add ${WORKTREE}`);
  // The add threw -> no teardown: never remove a path this task didn't create (it may be a sibling's).
  expect(calls).not.toContain(`remove ${WORKTREE}`);
});

test("a failed provider run yields run.ok=false — the draft-PR trigger", async () => {
  const ops: AgentOps = {
    run: async (command) => {
      await Promise.resolve();
      if (command.bin === "claude" && command.args[0] === "-p") {
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

test("runTask emits the lifecycle phases in order — the live-orchestration signal", async () => {
  const { ops } = fakeOps(0);
  const phases: string[] = [];
  await runTask({
    context,
    cwd: "/repo",
    issue,
    onPhase: (phase) => {
      phases.push(phase);
    },
    ops,
    provider: claudeCode,
  });
  expect(phases).toEqual(["worktree", "develop", "review", "format", "gates", "publish", "done"]);
});

test("a failed provider run skips the review — no spec-review when nothing was developed", async () => {
  const { ops } = fakeOps(0, 1);
  const phases: string[] = [];
  await runTask({
    context,
    cwd: "/repo",
    issue,
    onPhase: (phase) => {
      phases.push(phase);
    },
    ops,
    provider: claudeCode,
  });
  expect(phases).toEqual(["worktree", "develop", "format", "gates", "done"]);
});

test("the worktree is auto-formatted before the gate — a format deviation can never fail the gate", async () => {
  const commands: string[] = [];
  const ops: AgentOps = {
    run: async (command) => {
      await Promise.resolve();
      commands.push(`${command.bin} ${command.args.join(" ")}`.trim());
      if (command.bin === "claude" && command.args[0] === "--print") {
        return { code: 0, output: REVIEW_OK };
      }
      if (command.bin === "claude") {
        return { code: 0, output: "ok" };
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
  await runTask({ context, cwd: "/repo", issue, ops, provider: claudeCode });
  const fmtAt = commands.indexOf("vp fmt");
  const gateAt = commands.indexOf("vp check");
  expect(fmtAt).toBeGreaterThanOrEqual(0);
  expect(fmtAt).toBeLessThan(gateAt);
});

test("the executor gets fix rounds — a gate red then green after a fix publishes a non-draft", async () => {
  let firstGate = true;
  const calls: string[] = [];
  const ops: AgentOps = {
    run: async (command) => {
      await Promise.resolve();
      calls.push(`run ${command.bin}`);
      if (command.bin === "claude" && command.args[0] === "--print") {
        return { code: 0, output: REVIEW_OK };
      }
      if (command.bin === "vp" && command.args[0] === "check") {
        if (firstGate) {
          firstGate = false;
          return { code: 1, output: "lint error" };
        }
        return { code: 0, output: "" };
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
  const phases: string[] = [];
  const outcome = await runTask({
    context,
    cwd: "/repo",
    issue,
    onPhase: (phase) => {
      phases.push(phase);
    },
    ops,
    provider: claudeCode,
  });
  expect(phases).toContain("fix");
  expect(outcome.verdict.ok).toBe(true);
  expect(calls).toContain("run gh");
});

test("a non-compliant spec review triggers a re-dispatch before the quality gates", async () => {
  let reviewRound = 0;
  const calls: string[] = [];
  const ops: AgentOps = {
    run: async (command) => {
      await Promise.resolve();
      calls.push(`run ${command.bin} ${command.args[0] ?? ""}`);
      if (command.bin === "claude" && command.args[0] === "--print") {
        reviewRound += 1;
        if (reviewRound === 1) {
          return {
            code: 0,
            output: JSON.stringify({ compliant: false, feedback: "missing test" }),
          };
        }
        return { code: 0, output: REVIEW_OK };
      }
      if (command.bin === "claude") {
        return { code: 0, output: "ok" };
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
  expect(outcome.run.ok).toBe(true);
  const MIN_REVIEW_CALLS = 2;
  const reviewCalls = calls.filter((call) => call.startsWith("run claude --print"));
  expect(reviewCalls.length).toBeGreaterThanOrEqual(MIN_REVIEW_CALLS);
});

test("a provider without reviewCommand skips the spec review — review phase is still emitted", async () => {
  const providerNoReview: Provider = {
    command: codex.command,
    models: codex.models,
    name: "codex",
  };
  const phases: string[] = [];
  const ops: AgentOps = {
    run: async () => {
      await Promise.resolve();
      return { code: 0, output: "" };
    },
    worktreeAdd: async () => {
      await Promise.resolve();
    },
    worktreeRemove: async () => {
      await Promise.resolve();
    },
  };
  await runTask({
    context,
    cwd: "/repo",
    issue,
    onPhase: (phase) => {
      phases.push(phase);
    },
    ops,
    provider: providerNoReview,
  });
  expect(phases).toContain("review");
  expect(phases).toEqual(["worktree", "develop", "review", "format", "gates", "publish", "done"]);
});

test("a failed run skips the publish phase (nothing developed)", async () => {
  const { ops } = fakeOps(0, 1);
  const phases: string[] = [];
  await runTask({
    context,
    cwd: "/repo",
    issue,
    onPhase: (phase) => {
      phases.push(phase);
    },
    ops,
    provider: claudeCode,
  });
  expect(phases).toEqual(["worktree", "develop", "format", "gates", "done"]);
});
