import { childEnv, killRunningAgents, realOps } from "../src/real-ops.ts";
import { expect, test } from "vite-plus/test";
import { tmpdir } from "node:os";

const EXIT_CODE = 3;

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

test("killRunningAgents terminates a running child before it finishes", async () => {
  // 30 s — long enough that killRunningAgents fires while the child is still alive.
  const LONG_MS = 30_000;
  const runPromise = realOps().run(
    { args: ["-e", `setTimeout(() => {}, ${LONG_MS})`], bin: "node" },
    tmpdir(),
  );
  // Yield to the event loop so spawn can register the PID before we kill it.
  await Promise.resolve();
  killRunningAgents();
  const result = await runPromise;
  // A SIGTERM'd child exits non-zero (null code -> resolves to 1).
  expect(result.code).not.toBe(0);
});
