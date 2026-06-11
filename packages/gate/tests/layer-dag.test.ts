import { existsSync, readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { isRecord } from "@vow/core";
import { layerViolations } from "../src/layers.ts";
import path from "node:path";

/** The @vow dependency graph, as `layerViolations` takes it. */
type DepGraph = Parameters<typeof layerViolations>[0];

const VOW_PREFIX = "@vow/";

/** The `@vow` keys (prefix stripped) in one dependency field of a `package.json`. */
function vowKeysIn(deps: unknown): string[] {
  if (!isRecord(deps)) {
    return [];
  }
  return Object.keys(deps)
    .filter((key) => key.startsWith(VOW_PREFIX))
    .map((key) => key.slice(VOW_PREFIX.length));
}

/** The `@vow` deps a `package.json` declares across dependencies + devDependencies + peerDependencies
 *  (prefix stripped) — an upward import via ANY of the three breaks the DAG, so all three are read. */
function vowDeps(json: string): string[] {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) {
    return [];
  }
  const fields = ["dependencies", "devDependencies", "peerDependencies"];
  return [...new Set(fields.flatMap((field) => vowKeysIn(parsed[field])))];
}

/** Build the @vow dependency graph from every package's `package.json` (sibling to this gate package). */
function depGraph(): DepGraph {
  const packages = path.resolve(import.meta.dirname, "..", "..");
  const graph: [string, readonly string[]][] = [];
  for (const name of readdirSync(packages)) {
    const file = path.join(packages, name, "package.json");
    if (existsSync(file)) {
      graph.push([name, vowDeps(readFileSync(file, "utf8"))]);
    }
  }
  return graph;
}

test("the @vow dependency graph is a clean 4-layer DAG — no upward, unassigned, or cyclic imports", () => {
  expect(layerViolations(depGraph())).toEqual([]);
});

test("the gate catches an upward import (a lower layer depending on a higher one)", () => {
  expect(layerViolations([["core", ["gate"]]])).not.toEqual([]);
});

test("the gate catches a dependency cycle", () => {
  expect(
    layerViolations([
      ["a", ["b"]],
      ["b", ["a"]],
    ]),
  ).not.toEqual([]);
});
