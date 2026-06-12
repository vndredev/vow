// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGate } from "../src/index.ts";
import { tmpdir } from "node:os";

/** Run `body` against a fresh temp dir, cleaning it up afterwards — keeps each test body small. */
function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), "vow-gate-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

/**
 * The live red path: runGate's whole generate-then-scan pipeline can actually fail. A `bind` vow
 * promises a `## proves` claim whose body is hand-written, so unlike an `emit` vow nothing generates
 * a matching test — with no hand-written test named after the claim, the claim must survive to
 * `uncovered`. This exercises the gate's purpose (a promised-but-unproven scenario going red), not
 * just the isolated `uncoveredScenarios` set-difference helper.
 */
test("runGate reports a bind ## proves claim with no matching test as uncovered (the live red path)", () => {
  inTempDir((dir) => {
    const vowDir = path.join(dir, "app");
    const outDir = path.join(dir, ".generated");
    const claim = "a discount applies from 10 units";
    mkdirSync(vowDir, { recursive: true });
    // A bind vow + its co-located hand-written module — but NO test named after the claim.
    writeFileSync(
      path.join(vowDir, "invoice-total.vow.md"),
      [
        "---",
        "id: vow_invoicetotal",
        "fulfills: bind ./invoice-total.ts#computeTotal",
        "---",
        "",
        "# Invoice total",
        "",
        "## proves",
        "",
        `- ${claim}`,
        "",
      ].join("\n"),
    );
    writeFileSync(
      path.join(vowDir, "invoice-total.ts"),
      "export function computeTotal(): number {\n  return 0;\n}\n",
    );

    const { expected, uncovered } = runGate({ outDir, testRoots: [vowDir], vowDir });
    // The claim is promised...
    expect(expected).toContain(claim);
    // ...and, with no test of that name anywhere in the roots, it survives to uncovered: the gate is red.
    expect(uncovered).toContain(claim);
  });
});

/**
 * The same fixture, now with a matching hand-written test, must go green — proving the red above is
 * the claim's coverage, not the pipeline failing for an unrelated reason.
 */
test("runGate covers a bind claim once a test of that exact name exists (the live green path)", () => {
  inTempDir((dir) => {
    const vowDir = path.join(dir, "app");
    const outDir = path.join(dir, ".generated");
    const claim = "a discount applies from 10 units";
    mkdirSync(vowDir, { recursive: true });
    writeFileSync(
      path.join(vowDir, "invoice-total.vow.md"),
      [
        "---",
        "id: vow_invoicetotal",
        "fulfills: bind ./invoice-total.ts#computeTotal",
        "---",
        "",
        "# Invoice total",
        "",
        "## proves",
        "",
        `- ${claim}`,
        "",
      ].join("\n"),
    );
    writeFileSync(
      path.join(vowDir, "invoice-total.ts"),
      "export function computeTotal(): number {\n  return 0;\n}\n",
    );
    // A hand-written test named EXACTLY the claim — naming-coverage is satisfied.
    writeFileSync(
      path.join(vowDir, "invoice-total.test.ts"),
      `test(${JSON.stringify(claim)}, () => {});\n`,
    );

    const { uncovered } = runGate({ outDir, testRoots: [vowDir], vowDir });
    expect(uncovered).toEqual([]);
  });
});
