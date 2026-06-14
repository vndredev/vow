import { childEnv, killActiveChildren, realOps } from "../src/real-ops.ts";
import { expect, test } from "vite-plus/test";
import { tmpdir } from "node:os";

const EXIT_CODE = 3;
// A node process that sleeps this long will never exit on its own during a test — used to verify that
// `killActiveChildren` can terminate it before the test times out.
const LONG_RUN_MS = 60_000;

test("realOps.run executes a real command and maps exit 0 to ok + captures stdout", async () => {
  const result = await realOps().run(
    { args: ["-e", "process.stdout.write('hi')"], bin: "node" },
    tmpdir(),
  );
  expect(result.code).toBe(0);
  expect(result.output).toContain("hi");
});

test("realOps.run maps a non-zero exit to its code instead of throwing", async () => {
  const result = await realOps().run(
    { args: ["-e", `process.exit(${EXIT_CODE})`], bin: "node" },
    tmpdir(),
  );
  expect(result.code).toBe(EXIT_CODE);
});

test("realOps.run captures a failing command's output (so a draft PR can show it)", async () => {
  const result = await realOps().run(
    { args: ["-e", "process.stdout.write('boom'); process.exit(1)"], bin: "node" },
    tmpdir(),
  );
  expect(result.code).toBe(1);
  expect(result.output).toContain("boom");
});

test("realOps.run captures a failing command's STDERR — where git/gh/tsgo write the real reason", async () => {
  const result = await realOps().run(
    { args: ["-e", "process.stderr.write('the real reason'); process.exit(1)"], bin: "node" },
    tmpdir(),
  );
  expect(result.code).toBe(1);
  expect(result.output).toContain("the real reason");
});

test("childEnv strips the unsetEnv vars from the parent (the subscription auth-strip), keeps the rest", () => {
  const parent = { ANTHROPIC_API_KEY: "secret", PATH: "/bin" };
  expect(childEnv(parent, ["ANTHROPIC_API_KEY"])).toEqual({ PATH: "/bin" });
  expect(childEnv(parent, [])).toEqual(parent);
});

test("killActiveChildren terminates a tracked in-flight child — the shutdown contract (#683)", async () => {
  // Start a node process that would run for 60 seconds without intervention.
  // `execText` adds the child to activeChildren before its first await, so the child is already tracked
  // By the time `run()` returns its Promise — no extra await needed before calling kill.
  const runPromise = realOps().run(
    { args: ["-e", `setTimeout(() => {}, ${LONG_RUN_MS})`], bin: "node" },
    tmpdir(),
  );
  killActiveChildren();
  const result = await runPromise;
  // A process terminated by SIGTERM exits with code null → mapped to 1 in execText.
  expect(result.code).not.toBe(0);
});
