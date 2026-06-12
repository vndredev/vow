import { expect, test } from "vite-plus/test";
import { runReport } from "../src/index.ts";

const NUM = 7;
const ISSUE = { body: "b", number: NUM, title: "Add a thing" };

test("runReport shows the provider outcome, each gate, and a merge verdict when green", () => {
  const report = runReport(ISSUE, {
    run: { ok: true, output: "" },
    verdict: {
      ok: true,
      results: [
        { command: "vp check", ok: true },
        { command: "pnpm -r test", ok: true },
      ],
    },
  });
  expect(report).toContain(`issue #${NUM}: Add a thing`);
  expect(report).toContain("provider run: ok");
  expect(report).toContain("ok   vp check");
  expect(report).toContain("would merge");
});

test("runReport flags a failed gate + a draft verdict", () => {
  const report = runReport(ISSUE, {
    run: { ok: true, output: "" },
    verdict: { ok: false, results: [{ command: "vp check", ok: false }] },
  });
  expect(report).toContain("FAIL vp check");
  expect(report).toContain("would open a draft");
});

test("runReport reports a failed provider run as no-PR, even when the (meaningless) gates pass", () => {
  const report = runReport(ISSUE, {
    run: { ok: false, output: "boom" },
    verdict: { ok: true, results: [{ command: "vp check", ok: true }] },
  });
  expect(report).toContain("provider run: failed");
  expect(report).toContain("nothing developed, no PR");
  expect(report).not.toContain("would merge");
});

test("runReport appends a failed provider run's output (the reason) under a reason: heading", () => {
  const report = runReport(ISSUE, {
    run: { ok: false, output: "  Error: gh: not authenticated\n" },
    verdict: { ok: true, results: [{ command: "vp check", ok: true }] },
  });
  expect(report).toContain("reason:");
  expect(report).toContain("  Error: gh: not authenticated");
});

test("runReport adds no reason for a successful run", () => {
  const report = runReport(ISSUE, {
    run: { ok: true, output: "all good" },
    verdict: { ok: true, results: [{ command: "vp check", ok: true }] },
  });
  expect(report).not.toContain("reason:");
});
