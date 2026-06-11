import { expect, test } from "vite-plus/test";
import { prBody, prCreateArgs, pushArgs, verify } from "../src/verify.ts";

/** A fake exec: any command containing "fail" exits non-zero, the rest pass. No process is spawned. */
const run = async (command: string): Promise<number> => {
  await Promise.resolve();
  if (command.includes("fail")) {
    return 1;
  }
  return 0;
};

test("verify runs every gate; the verdict is the conjunction", async () => {
  const green = await verify(["vp check", "pnpm -r test"], "/wt", run);
  expect(green.ok).toBe(true);
  const red = await verify(["vp check", "fail this"], "/wt", run);
  expect(red.ok).toBe(false);
  expect(red.results.find((result) => !result.ok)?.command).toBe("fail this");
});

test("a failing run opens a DRAFT pr, never a mergeable one", () => {
  expect(prCreateArgs("t", "b", true)).not.toContain("--draft");
  expect(prCreateArgs("t", "b", false)).toContain("--draft");
});

test("pushArgs publishes the branch; prBody shows the verdict + the plan", () => {
  expect(pushArgs("vow/issue-98")).toEqual(["push", "-u", "origin", "vow/issue-98"]);
  const body = prBody("THE PLAN", { ok: false, results: [{ command: "vp check", ok: false }] });
  expect(body).toContain("vp check");
  expect(body).toContain("THE PLAN");
});
