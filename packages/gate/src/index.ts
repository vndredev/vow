import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadVowForest, uncoveredScenarios, type Vow } from "@vow/core";
import { entityProves } from "@vow/emit-entity";
import { allVows, generateFiles } from "@vow/vite-plugin";

/**
 * vow's scenario-coverage gate — the tor that keeps a promise from going unproven.
 *
 * `runGate` generates first (so `.generated/` tests exist — this also solves generate-before-test),
 * then checks that every scenario promised across the whole vow forest has a matching test in the
 * corpus. Any uncovered claim is an unproven promise → the caller fails the gate.
 */

/** The scenarios a vow promises: derived for `emit entity`, authored (`## proves`) otherwise. */
export function expectedScenarios(vow: Vow): string[] {
  if (vow.fulfills?.kind === "emit" && vow.fulfills.as === "entity") return entityProves(vow);
  return vow.proof.map((p) => p.claim);
}

/** Every `test("…")` / `it("…")` name in a test source (the name may contain other quote chars). */
export function testNamesIn(source: string): string[] {
  return [...source.matchAll(/(?:test|it)\(\s*(["'`])(.*?)\1/g)].map((m) => m[2] ?? "");
}

/** Recursively collect test names from every `*.test.ts(x)` under the given roots. */
export function collectTestNames(roots: readonly string[]): string[] {
  const names: string[] = [];
  const walk = (dir: string): void => {
    let children: string[];
    try {
      children = readdirSync(dir);
    } catch {
      return; // missing dir → nothing to collect
    }
    for (const name of children) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.test\.tsx?$/.test(name)) names.push(...testNamesIn(readFileSync(p, "utf8")));
    }
  };
  for (const r of roots) walk(r);
  return names;
}

export interface GateResult {
  readonly expected: readonly string[];
  readonly uncovered: readonly string[];
}

/** Generate, then check coverage of every promised scenario across the forest. */
export function runGate(opts: {
  readonly vowDir: string;
  readonly outDir: string;
  readonly testRoots: readonly string[];
}): GateResult {
  const vows = loadVowForest(opts.vowDir);
  generateFiles(vows, opts.outDir, opts.vowDir); // generate-before-test
  const expected = allVows(vows).flatMap(expectedScenarios);
  const testNames = collectTestNames(opts.testRoots);
  return { expected, uncovered: uncoveredScenarios(expected, testNames) };
}
