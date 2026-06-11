import { expect, test } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { frameworkViolations } from "../src/framework.ts";
import path from "node:path";

/** One emitter source to scan, as `frameworkViolations` takes them. */
type EmitterSource = Parameters<typeof frameworkViolations>[0][number];

/* The emitter packages whose source must be framework-neutral — they emit through @vow/component, never
   as raw SFC strings, so a React/Solid/Svelte adapter can render the same UiNode. Includes the doc
   emitters (docs/markdown), which the audit found bypassing the scan, and the app-chrome (shell), whose
   pieces are migrating off hand-written Vue onto the model (the dark-toggle is the first). */
const EMIT_PACKAGES = ["emit-view", "emit-entity", "emit-primitive", "docs", "markdown", "shell"];

/* Tracked, shrinking debt — the only emitters allowed to write raw framework syntax today: boot.ts (the
   framework-specific app entry) + sfc.ts (the docs prose SFC, awaits the model rewrite). issue-sfc.ts and
   timeline.ts now route through the canonical model (#100), so they are no longer allowed to bypass it.
   Keyed by package-qualified path so the exemption points at exactly those two files — a future boot.ts or
   sfc.ts in any other emit package is not silently exempt. */
const ALLOW = ["emit-view/boot.ts", "docs/sfc.ts"];

/** Read every emitter `.ts` source across the emit packages (sibling to this gate package). The file key is
 *  package-qualified (`<pkg>/<name>`) so the allowlist exempts exactly its intended files, not every
 *  same-named file across packages. */
function emitterSources(): EmitterSource[] {
  const packages = path.resolve(import.meta.dirname, "..", "..");
  const sources: EmitterSource[] = [];
  for (const pkg of EMIT_PACKAGES) {
    const srcDir = path.join(packages, pkg, "src");
    for (const name of readdirSync(srcDir)) {
      if (name.endsWith(".ts")) {
        sources.push({
          file: path.join(pkg, name),
          source: readFileSync(path.join(srcDir, name), "utf8"),
        });
      }
    }
  }
  return sources;
}

test("no emitter writes raw framework syntax — generation goes through @vow/component", () => {
  expect(frameworkViolations(emitterSources(), ALLOW)).toEqual([]);
});

test("the gate catches a raw-Vue bypass (so a model bypass can't pass silently)", () => {
  const planted: EmitterSource[] = [
    { file: "drift.ts", source: '`<template><li v-for="x in xs">`' },
  ];
  expect(frameworkViolations(planted, [])).not.toEqual([]);
});
