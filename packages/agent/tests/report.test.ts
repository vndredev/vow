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
