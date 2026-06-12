import {
  commitArgs,
  prBody,
  prCreateArgs,
  prTitle,
  pushArgs,
  stageArgs,
  verify,
} from "../src/verify.ts";
import { expect, test } from "vite-plus/test";
import type { RunResult } from "../src/types.ts";

const TITLE_MAX = 72;
const OVERLONG = 100;

/** A fake exec: any command containing "fail" exits non-zero with a stderr-style reason, the rest pass. No
 *  process is spawned. */
const run = async (command: string): Promise<RunResult> => {
  await Promise.resolve();
  if (command.includes("fail")) {
    return { code: 1, output: `${command}: boom` };
  }
  return { code: 0, output: "" };
};

test("verify runs every gate; the verdict is the conjunction", async () => {
  const green = await verify(["vp check", "pnpm -r test"], "/wt", run);
  expect(green.ok).toBe(true);
  const red = await verify(["vp check", "fail this"], "/wt", run);
  expect(red.ok).toBe(false);
  expect(red.results.find((result) => !result.ok)?.command).toBe("fail this");
});

test("verify keeps a failed gate's captured output (the reason), not just its command", async () => {
  const red = await verify(["fail this"], "/wt", run);
  expect(red.results[0]?.output).toBe("fail this: boom");
});

test("prBody renders a failed gate's captured output under its ✗ — the reason reaches the PR", () => {
  const body = prBody("THE PLAN", {
    ok: false,
    results: [{ command: "vp check", ok: false, output: "src/x.ts(3,1): TS2304" }],
  });
  expect(body).toContain("- ✗ `vp check`");
  expect(body).toContain("src/x.ts(3,1): TS2304");
});

test("a failing run opens a DRAFT pr, never a mergeable one", () => {
  expect(prCreateArgs("t", "b", true)).not.toContain("--draft");
  expect(prCreateArgs("t", "b", false)).toContain("--draft");
});

test("pushArgs publishes the branch; prBody shows the verdict + the plan", () => {
  expect(pushArgs("feat/issue-98")).toEqual(["push", "-u", "origin", "feat/issue-98"]);
  const body = prBody("THE PLAN", { ok: false, results: [{ command: "vp check", ok: false }] });
  expect(body).toContain("vp check");
  expect(body).toContain("THE PLAN");
});

test("prTitle is a conventional-commit subject — defaulted to feat, lower-cased, capped at 72", () => {
  expect(prTitle({ title: "Add a widget" })).toBe("feat: add a widget");
  expect(prTitle({ title: "X".repeat(OVERLONG) }).length).toBe(TITLE_MAX);
});

test("prTitle keeps a title that already opens with a conventional type — no feat: docs: double", () => {
  expect(prTitle({ title: "docs: note the thing" })).toBe("docs: note the thing");
  expect(prTitle({ title: "fix: a bug" })).toBe("fix: a bug");
});

test("stageArgs + commitArgs build the agent's worktree commit (commit skips the local hook)", () => {
  expect(stageArgs()).toEqual(["add", "-A"]);
  expect(commitArgs("feat: x")).toEqual(["commit", "-m", "feat: x", "--no-verify"]);
});
