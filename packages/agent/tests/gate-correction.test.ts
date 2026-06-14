import { correctionBlock, gateCorrections } from "../src/gate-correction.ts";
import { expect, test } from "vite-plus/test";
import type { VerifyResult } from "../src/types.ts";

/** A failing verdict whose single gate emitted `output` — the shape a red gate produces. */
function redVerdict(output: string): VerifyResult {
  return { ok: false, results: [{ command: "vp lint", ok: false, output }] };
}

test("each known banned rule maps to its named, concrete remedy", () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ["no-ternary", "form.ts:12: eslint(no-ternary)", "if/else block"],
    ["no-negated-condition", "x.ts: no-negated-condition", "POSITIVE branch first"],
    ["no-undefined", "y.ts: no-undefined here", "Maybe"],
    ["no-non-null-assertion", "z.ts: no-non-null-assertion", "defined(x)"],
    ["no-explicit-any", "a.ts: no-explicit-any", "narrow it with a type predicate"],
    ["no-magic-numbers", "b.ts: no-magic-numbers", "lift it to a `const`"],
    ["max-lines", "c.ts: max-lines exceeded", "split it by CONCERN"],
    ["framework-neutrality", "framework-neutrality: emitter wrote <template>", "@vow/component"],
    ["provider-neutrality", "provider-neutrality: claude hardcoded", "Provider` adapter"],
    ["design-language", "design-language: vow-x has no token in vow.css", "vow.css token"],
    ["no-cycle", "import cycle: no-cycle a -> b -> a", "clean DAG"],
    ["has-a-doc", "has-a-doc: element missing a doc page", "docs/"],
    [
      "cannot-find-name",
      "x.ts:5:3: error typescript(TS2304): Cannot find name 'sfc'",
      "DESTRUCTURE",
    ],
    ["cannot-find-name", "x.ts:5:3: error typescript(TS2552): Cannot find name 'v'", "DESTRUCTURE"],
    [
      "cannot-find-module",
      "a.ts: error typescript(TS2307): Cannot find module '@vow/core'",
      "workspace:*",
    ],
    [
      "cannot-find-module",
      "Cannot find package '@vow/core' imported from real-ops.ts",
      "workspace:*",
    ],
    ["capitalized-comments", "f.ts:3: eslint(capitalized-comments)", "capital letter"],
    ["no-inline-comments", "f.ts:3: eslint(no-inline-comments)", "OWN line"],
    ["require-await", "f.ts:5:16: error eslint(require-await)", "remove the `async`"],
    ["sort-imports", "f.ts:4:1: error eslint(sort-imports)", "multiple-specifier"],
  ];
  for (const [rule, output, fragment] of cases) {
    const corrections = gateCorrections(redVerdict(output));
    const match = corrections.find((correction) => correction.rule === rule);
    expect(match?.rule).toBe(rule);
    expect(match?.remedy).toContain(fragment);
  }
});

test("the two live-stall classes self-explain — an undeclared @vow import + a bare sfc in a test (#689)", () => {
  // The exact failures that stalled real develop rounds: a bare emit-view field named in a test plus an undeclared cross-package import (before #689 the fix-rounds saw only the raw TS error, with no remedy).
  const block = correctionBlock(
    redVerdict(
      [
        "loop-views.test.ts:144:10: error typescript(TS2304): Cannot find name 'sfc'",
        "Cannot find package '@vow/core' imported from packages/agent/src/real-ops.ts",
      ].join("\n"),
    ),
  );
  expect(block).toContain("- **cannot-find-name** —");
  expect(block).toContain("const { sfc } = buildView");
  expect(block).toContain("- **cannot-find-module** —");
  expect(block).toContain('"@vow/<pkg>": "workspace:*"');
});

test("sort-imports gets its OWN remedy, not the sort-keys 'run vp fmt' advice that can't sort imports (#694)", () => {
  const corrections = gateCorrections(redVerdict("agent-auto.ts:27:1: error eslint(sort-imports)"));
  const sortImports = corrections.find((correction) => correction.rule === "sort-imports");
  expect(sortImports?.remedy).toContain("does NOT sort imports");
  const rules = corrections.map((correction) => correction.rule);
  // A sort-keys correction must NOT fire for an imports-only failure — its "run vp fmt" advice would mislead.
  expect(rules).not.toContain("sort-keys");
});

test("an unknown rule yields no correction — its verbatim output passes through (never lossy)", () => {
  const corrections = gateCorrections(redVerdict("x.ts: some-rule-vow-never-banned exploded"));
  expect(corrections).toEqual([]);
  // The block is empty so the caller appends nothing — the raw output still stands alone.
  expect(correctionBlock(redVerdict("x.ts: totally-unknown-rule"))).toBe("");
});

test("a clean (all-green) verdict yields no correction", () => {
  const green: VerifyResult = { ok: true, results: [{ command: "vp lint", ok: true }] };
  expect(gateCorrections(green)).toEqual([]);
  expect(correctionBlock(green)).toBe("");
});

test("a passed gate inside a red verdict is skipped — only the failures are mapped", () => {
  const verdict: VerifyResult = {
    ok: false,
    results: [
      { command: "vp lint", ok: false, output: "f.ts: no-ternary" },
      {
        command: "pnpm -r test",
        ok: true,
        output: "this string says no-undefined but the gate PASSED",
      },
    ],
  };
  const rules = gateCorrections(verdict).map((correction) => correction.rule);
  expect(rules).toContain("no-ternary");
  // The passing gate's output is never scanned — its incidental "no-undefined" doesn't leak a correction.
  expect(rules).not.toContain("no-undefined");
});

test("the same rule tripped across two gates is reported once (deduped)", () => {
  const verdict: VerifyResult = {
    ok: false,
    results: [
      { command: "vp lint", ok: false, output: "a.ts: no-undefined" },
      { command: "vp check", ok: false, output: "b.ts: no-undefined" },
    ],
  };
  const undefineds = gateCorrections(verdict).filter(
    (correction) => correction.rule === "no-undefined",
  );
  expect(undefineds.length).toBe(1);
});

test("correctionBlock is the self-explaining `## How to comply` section, one bullet per rule", () => {
  const block = correctionBlock(redVerdict("form.ts:12 no-ternary\nx.ts no-negated-condition"));
  expect(block).toContain("## How to comply");
  expect(block).toContain("- **no-ternary** —");
  expect(block).toContain("- **no-negated-condition** —");
});

test("gateCorrections is pure — same verdict in, same corrections out", () => {
  const verdict = redVerdict("no-ternary");
  expect(gateCorrections(verdict)).toEqual(gateCorrections(verdict));
});
