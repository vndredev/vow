/**
 * The framework-neutrality gate — emitter source must never write raw framework syntax (a Vue `<template>`,
 * a directive, an event/bind shorthand). Generation goes through the canonical `@vow/component` model (the
 * one place a framework adapter lives), so a React/Solid/Svelte adapter can render the same `UiNode`. A
 * literal SFC marker in an emitter IS the single-framework hardcode this gate exists to forbid — the drift
 * made mechanical: a new emitter that bypasses the model fails the build, instead of relying on discipline.
 */

/** A forbidden marker: its display name + the pattern that proves an emitter wrote raw framework syntax. */
interface Marker {
  readonly name: string;
  readonly re: RegExp;
}

/** The raw-framework markers. `<template>`/`<script setup>` catch any emitted SFC string (the safety net);
 *  the directive + `@event`/`:bind` shorthands catch a hand-written control even outside a full SFC. */
const MARKERS: readonly Marker[] = [
  { name: "<template>", re: /<template[\s>]/u },
  { name: "<script setup>", re: /<script setup/u },
  { name: "v-for", re: /[^\w]v-for=/u },
  { name: "v-if", re: /[^\w]v-if=/u },
  { name: "@event", re: /[^\w]@[a-z]+=/u },
  { name: ":bind", re: /[^\w]:[a-z][\w-]*=/u },
];

/** One emitter source file to scan — its name (the allowlist key) and its full contents. */
export interface EmitterSource {
  readonly file: string;
  readonly source: string;
}

/** A model bypass found in an emitter — the file, and which raw-framework marker it wrote. */
export interface FrameworkViolation {
  readonly file: string;
  readonly marker: string;
}

/**
 * Every raw-framework marker an emitter wrote, excluding the `allow` list — the tracked, shrinking debt
 * (today: `boot.ts`, the framework-specific app entry, plus `issue-sfc.ts`/`timeline.ts` awaiting the
 * model rewrite). An empty result means every other emitter is framework-neutral. Pure: the caller reads
 * the files, this only matches — so the rule is unit-testable without the filesystem.
 */
/** Source with block + line comments removed — so a marker inside a JSDoc example (e.g. `helpers.ts`
 *  documenting a `:name="expr"` attribute) is never mistaken for a real bypass. */
function decomment(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//gu, "").replaceAll(/\/\/[^\n]*/gu, "");
}

/** The marker names a code string contains (comments already stripped). */
function markersIn(code: string): string[] {
  const found: string[] = [];
  for (const marker of MARKERS) {
    if (marker.re.test(code)) {
      found.push(marker.name);
    }
  }
  return found;
}

export function frameworkViolations(
  sources: readonly EmitterSource[],
  allow: readonly string[],
): FrameworkViolation[] {
  const violations: FrameworkViolation[] = [];
  for (const source of sources) {
    if (!allow.includes(source.file)) {
      for (const marker of markersIn(decomment(source.source))) {
        violations.push({ file: source.file, marker });
      }
    }
  }
  return violations;
}
