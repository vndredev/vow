import {
  commitArgs,
  fixPrompt,
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
// The `## Proof` checkboxes the pr-body gate requires: one per gate (vp check · pnpm -r test) + the doc.
const PROOF_CHECKBOXES = 3;

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

test("prBody is the template the pr-body gate demands — Summary/What/Proof/Next + Closes, a failed gate unchecked", () => {
  const body = prBody(
    { number: 98, title: "the loop" },
    {
      ok: false,
      results: [
        { command: "vp check", ok: false, output: "TS2304" },
        { command: "pnpm -r test", ok: true },
      ],
    },
  );
  for (const heading of ["## Summary", "## What", "## Proof", "## Next"]) {
    expect(body).toContain(heading);
  }
  expect(body).toContain("Closes #98");
  // A failed gate stays unchecked, marking the draft; the proof has the 3 checkboxes the gate requires.
  expect(body).toContain("- [ ] `vp check`");
  expect(body.match(/- \[[ x]\]/gu)?.length).toBe(PROOF_CHECKBOXES);
});

test("a failing run opens a DRAFT pr, never a mergeable one", () => {
  expect(prCreateArgs("t", "b", true)).not.toContain("--draft");
  expect(prCreateArgs("t", "b", false)).toContain("--draft");
});

test("pushArgs publishes the branch; prBody checks a passed gate", () => {
  // Force-with-lease so a re-run over a stale remote feat/issue-N publishes instead of a non-fast-forward reject.
  expect(pushArgs("feat/issue-98")).toEqual([
    "push",
    "--force-with-lease",
    "-u",
    "origin",
    "feat/issue-98",
  ]);
  const body = prBody(
    { number: 98, title: "t" },
    { ok: true, results: [{ command: "vp check", ok: true }] },
  );
  expect(body).toContain("- [x] `vp check`");
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

test("the fix-round prompt leads with the self-explaining correction, then the verbatim failures", () => {
  const prompt = fixPrompt({
    ok: false,
    results: [{ command: "vp lint", ok: false, output: "form.ts:12: lint(no-ternary)" }],
  });
  // The NAMED rewrite for the banned rule comes first, so the next round self-corrects, not guesses.
  expect(prompt).toContain("## How to comply");
  expect(prompt).toContain("- **no-ternary** —");
  expect(prompt).toContain("if/else block");
  // The raw output is still carried verbatim, below the correction.
  expect(prompt).toContain("## Failing gates");
  expect(prompt.indexOf("## How to comply")).toBeLessThan(prompt.indexOf("## Failing gates"));
  expect(prompt).toContain("form.ts:12: lint(no-ternary)");
});

test("the fix-round prompt for an UNKNOWN rule has no comply block — just the verbatim failures", () => {
  const prompt = fixPrompt({
    ok: false,
    results: [
      {
        command: "vp test packages/agent",
        ok: false,
        output: "AssertionError: expected 1 to be 2",
      },
    ],
  });
  expect(prompt).not.toContain("## How to comply");
  expect(prompt).toContain("## Failing gates");
  expect(prompt).toContain("AssertionError: expected 1 to be 2");
});

test("the fix-round prompt confirms with the FAST gates, NOT the whole-repo pnpm -r test (#676)", () => {
  const prompt = fixPrompt({
    ok: false,
    results: [{ command: "vp lint", ok: false, output: "form.ts:12: lint(no-ternary)" }],
  });
  // The fix-round must stay fast — confirm via `vp lint` + the touched package, never the whole-repo suite.
  expect(prompt).toContain("vp lint");
  expect(prompt).toContain("touched package");
  expect(prompt).toContain("do NOT");
  expect(prompt).not.toContain("`pnpm -r test` must BOTH exit 0");
});
