import { expect, test } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { frameworkViolations } from "../src/framework.ts";
import path from "node:path";

/** One emitter source to scan, as `frameworkViolations` takes them. */
type EmitterSource = Parameters<typeof frameworkViolations>[0][number];

/* The emitter packages whose source must be framework-neutral — they emit through @vow/component, never
   as raw SFC strings, so a React/Solid/Svelte adapter can render the same UiNode. */
const EMIT_PACKAGES = ["emit-view", "emit-entity", "emit-primitive"];

/* Tracked, shrinking debt — the only emitters allowed to write raw framework syntax today: boot.ts (the
   framework-specific app entry) + issue-sfc.ts / timeline.ts (await the model rewrite, #100). */
const ALLOW = ["boot.ts", "issue-sfc.ts", "timeline.ts"];

/** Read every emitter `.ts` source across the emit packages (sibling to this gate package). */
function emitterSources(): EmitterSource[] {
  const packages = path.resolve(import.meta.dirname, "..", "..");
  const sources: EmitterSource[] = [];
  for (const pkg of EMIT_PACKAGES) {
    const srcDir = path.join(packages, pkg, "src");
    for (const name of readdirSync(srcDir)) {
      if (name.endsWith(".ts")) {
        sources.push({ file: name, source: readFileSync(path.join(srcDir, name), "utf8") });
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
