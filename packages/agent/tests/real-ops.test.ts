import { expect, test } from "vite-plus/test";
import { realOps } from "../src/real-ops.ts";
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
