// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { verdictLines } from "../src/basics.ts";

test("verdictLines: a clean body is a one-line OK", () => {
  expect(verdictLines([])).toEqual(["PR body matches the template."]);
});

test("verdictLines: problems are listed + the template pointer follows (the pre-flight verdict)", () => {
  const lines = verdictLines(['## Next is missing — deferred work or "—".']);
  expect(lines[0]).toBe('  ✗ ## Next is missing — deferred work or "—".');
  expect(lines.at(-1)).toContain(".github/PULL_REQUEST_TEMPLATE.md");
  expect(lines.at(-1)).toContain("Summary, What, Proof, Next");
});
