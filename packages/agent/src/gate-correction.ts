/**
 * The self-explaining gate — a pure rule→remedy mapper that turns a raw gate failure into a NAMED,
 * actionable correction the fix-round prompt feeds back. The roster loop's fix-rounds stalled on
 * banned-SYNTAX failures (no-ternary / no-negated-condition / no-undefined) because the raw oxlint
 * output never told the agent WHICH rule to rewrite or how. This formatter names the violated rule + the
 * concrete rewrite ("no-ternary → rewrite `a ? b : c` as an if/else block"), so the next round self-corrects
 * instead of guessing. Mirrors the LLM HOOK's spirit (`hook.ts`): the wall explains itself + how to comply.
 *
 * It maps the KNOWN vow-banned rules (the oxlint quality wall + the vow gates: framework-neutrality,
 * provider-neutrality, design-language coverage, layer/no-cycle/max-lines, has-a-doc) AND the strict
 * tsgo typecheck's resolution errors (TS2304/TS2552 `Cannot find name`, TS2307 / `Cannot find package`
 * — the classes that stalled live develop rounds: an undeclared `@vow/*` import, a bare `sfc` in a test)
 * to a concrete remedy; an UNKNOWN rule passes through verbatim, so the correction is never lossy. Pure +
 * unit-tested, like the hook's verdict — no IO, no provider name.
 */

import type { VerifyResult } from "./types.ts";

/** One rule→remedy entry — the banned rule's id, a matcher against the raw gate output, and the concrete
 *  rewrite an agent applies to comply. The matcher keys off the rule id oxlint/the gate prints. */
interface RemedyRule {
  readonly id: string;
  readonly match: RegExp;
  readonly remedy: string;
}

/**
 * The KNOWN vow-banned rules, each mapped to its concrete rewrite — the oxlint quality wall first, then the
 * tsgo resolution errors (`Cannot find name`/`Cannot find module`), then the vow gates. Order is the report
 * order. Each `remedy` names the exact in-system pattern to apply, so the agent rewrites to comply instead of
 * re-approaching. New banned rules join this list (one source of truth).
 */
const REMEDIES: readonly RemedyRule[] = [
  {
    id: "no-ternary",
    match: /no-ternary/u,
    remedy:
      "rewrite the ternary `a ? b : c` as an if/else block (or extract a small named helper that returns from each branch). The wall forbids `?:`.",
  },
  {
    id: "no-negated-condition",
    match: /no-negated-condition/u,
    remedy:
      "invert the condition to its POSITIVE branch first — write `if (cond) { … } else { … }`, not `if (!cond)`. Lead with the affirmative case.",
  },
  {
    id: "no-undefined",
    match: /no-undefined/u,
    remedy:
      "never write the `undefined` literal — use the vow `Maybe<T>` seam: return `NONE` for absence and narrow with `defined(x)` (from @vow/core) instead of comparing to `undefined`.",
  },
  {
    id: "no-non-null-assertion",
    match: /no-non-null-assertion/u,
    remedy:
      "remove the non-null `!` assertion — narrow the value with `defined(x)` (the `Maybe` guard) or an explicit check, so the type follows the runtime shape instead of being forced.",
  },
  {
    id: "no-explicit-any",
    match: /no-explicit-any|\bany\b/u,
    remedy:
      "remove `any` — give the real type, or accept `unknown` and narrow it with a type predicate (`isRecord` / `defined`) before use. Fix the hole at its source, never widen to silence it.",
  },
  {
    id: "consistent-type-assertions",
    match: /consistent-type-assertions|no-unsafe|type assertion|\bas\b/u,
    remedy:
      "remove the `as` cast — narrow with a type predicate (a `value is T` guard) so the static type can't diverge from the runtime shape. A cast hides the divergence; the guard proves it.",
  },
  {
    id: "prefer-readonly-parameter-types",
    match: /prefer-readonly-parameter-types/u,
    remedy:
      "make the parameter deeply readonly (`Readonly<T>` / `readonly T[]`). EXCEPTION at an OS-adapter boundary (a `*-ops.ts` file): an inherently-mutable Node type (a stream, `EventEmitter`, `Buffer`, `ChildProcess`) can't be made readonly — apply a TARGETED `// oxlint-disable-next-line prefer-readonly-parameter-types -- <why it's read-only in use>` on that param's line, never a broad disable.",
  },
  {
    id: "cannot-find-name",
    match: /\bTS2304\b|\bTS2552\b|Cannot find name/u,
    remedy:
      "an identifier the code names isn't in scope (TS2304/TS2552 `Cannot find name`) — import it, declare it (`const`/`function`), or DESTRUCTURE it from the call that produces it. A test asserting on a generated SFC must capture it from the builder's return (`const { sfc } = buildView(view, entities)`), never reference a bare `sfc`/`v`. Never name a symbol you have not bound.",
  },
  {
    id: "cannot-find-module",
    match: /\bTS2307\b|Cannot find (?:module|package)/u,
    remedy:
      "an import doesn't resolve (TS2307 `Cannot find module` / `Cannot find package '@vow/...'`) — a cross-package import MUST be a declared dependency: add `\"@vow/<pkg>\": \"workspace:*\"` to THIS package's package.json `dependencies` (then `vp install` links it), or remove the import if it isn't needed. Never import a `@vow/*` package the manifest doesn't list.",
  },
  {
    id: "no-magic-numbers",
    match: /no-magic-numbers/u,
    remedy:
      "name the magic number — lift it to a `const` with a meaning, so the value reads as intent (the same rule the studio + emitters follow).",
  },
  {
    id: "require-await",
    match: /require-await/u,
    remedy:
      "an `async` function has no `await` — remove the `async` keyword (the function is synchronous), or `await` the async call it should be waiting on. Don't mark a sync function `async`.",
  },
  {
    id: "sort-keys",
    match: /sort-keys/u,
    remedy:
      "order the object keys alphabetically (run `vp fmt`; if it persists, apply the alphabetical order by hand).",
  },
  {
    id: "sort-imports",
    match: /sort-imports/u,
    remedy:
      "reorder the imports by hand — multiple-specifier imports (`import { a, b }`) before single-specifier (`import x`), then alphabetical. `vp fmt` does NOT sort imports, so this is a manual rewrite.",
  },
  {
    id: "no-duplicate-imports",
    match: /no-duplicate-imports/u,
    remedy:
      "merge the duplicate imports from one module into a single statement. When one is a value and one is a TYPE, use the sanctioned inline pattern: `import { type X, value } from 'm'` plus a file-top `/* oxlint-disable consistent-type-specifier-style -- value+type import */` (a separate top-level type import would re-trip this rule).",
  },
  {
    id: "consistent-type-specifier-style",
    match: /consistent-type-specifier-style/u,
    remedy:
      "use a top-level `import type { X } from 'm'`, not an inline `type` specifier. EXCEPTION: when the same module is imported as BOTH a value and a type, a separate type import trips `no-duplicate-imports` — use the sanctioned pattern (see `mcp/channel.ts`): inline `import { type X, value } from 'm'` plus a file-top `/* oxlint-disable consistent-type-specifier-style -- value+type import */`.",
  },
  {
    id: "capitalized-comments",
    match: /capitalized-comments/u,
    remedy:
      "a line comment must begin with a capital letter — rewrite `// fix the parser` as `// Fix the parser` (an `oxlint-disable`/`eslint-disable` directive is exempt).",
  },
  {
    id: "no-inline-comments",
    match: /no-inline-comments/u,
    remedy:
      "move the trailing same-line comment to its OWN line above the code — `const x = 1; // why` becomes a `// why` line then `const x = 1;`. The wall forbids inline (same-line) comments.",
  },
  {
    id: "max-lines",
    match: /max-lines\b|max-lines-per-function|file is too long|exceeds the .* line/u,
    remedy:
      "the file/function is over the line cap — split it by CONCERN into a sibling module (the layer keeps its index as the single entry), never blind-chunk it.",
  },
  {
    id: "framework-neutrality",
    match: /framework-neutrality|raw[- ]?framework|<template>|<script setup>|\bv-(?:if|for)\b/u,
    remedy:
      "an emitter wrote raw framework syntax — describe the UI through the neutral `@vow/component` model (a `UiNode`); a concrete framework (Vue/React/Svelte) is named ONLY behind its adapter seam.",
  },
  {
    id: "provider-neutrality",
    match: /provider-neutrality|provider CLI|hardcoded provider/u,
    remedy:
      "a provider CLI bin is named outside the provider seam — move it behind a `Provider` adapter; the loop must name no provider.",
  },
  {
    id: "design-language",
    match: /design-language|vow-\* class|bespoke value|missing .* token|vow\.css/u,
    remedy:
      "an emitted `vow-*` class has no rule in vow.css (a bespoke value) — add the token-backed rule to the design language; every value reads a vow.css token, no hardcode.",
  },
  {
    id: "no-cycle",
    match: /no-cycle|import cycle|circular/u,
    remedy:
      "an import points UP a layer / forms a cycle — invert the dependency so the package graph stays a clean DAG (import only from a lower layer's index).",
  },
  {
    id: "has-a-doc",
    match: /has-a-doc|docs-drift|missing .* doc|no doc page/u,
    remedy:
      "the change has no doc — update its page under `docs/` (a package's row in `docs/guide/packages.md`, an element's page) so the docs stay 1:1 with reality, honest, no overselling.",
  },
];

/** One named correction — the violated rule's id + the concrete rewrite to apply. */
export interface GateCorrection {
  readonly remedy: string;
  readonly rule: string;
}

/** The KNOWN-rule corrections a single gate's output trips — one per matched rule, in report order. An
 *  output naming no known rule yields none (the verbatim output already carries it). Pure. */
function correctionsFor(output: string): GateCorrection[] {
  const found: GateCorrection[] = [];
  for (const rule of REMEDIES) {
    if (rule.match.test(output)) {
      found.push({ remedy: rule.remedy, rule: rule.id });
    }
  }
  return found;
}

/** Every failed gate's captured output joined — the corpus the rule matchers scan. A passing gate is
 *  skipped, so its incidental mention of a rule name never leaks a correction. */
function failureOutput(verdict: Readonly<VerifyResult>): string {
  return verdict.results
    .filter((result) => !result.ok)
    .map((result) => result.output ?? "")
    .join("\n");
}

/**
 * The NAMED corrections a verify verdict's failures trip — every known banned rule across the failed gates,
 * each once + in report order (`correctionsFor` walks the one-per-rule REMEDIES list over the joined failure
 * corpus). A clean (all-green) verdict yields none; a failure naming no known rule yields none here (its
 * verbatim output is carried by `fixPrompt`). Pure — the heart of the self-explaining gate, unit-tested like
 * the hook's verdict.
 */
export function gateCorrections(verdict: Readonly<VerifyResult>): GateCorrection[] {
  return correctionsFor(failureOutput(verdict));
}

/** One correction as a fix-round bullet — `- **<rule>** — <remedy>`, the same explain-itself shape the
 *  hook's deny reason uses. */
function correctionLine(correction: Readonly<GateCorrection>): string {
  return `- **${correction.rule}** — ${correction.remedy}`;
}

/**
 * The `## How to comply` block the fix-round prompt prepends to the verbatim failures — the NAMED rewrite per
 * violated rule, so the next round self-corrects instead of guessing at the raw output. Empty (""), so the
 * caller can append it, when the verdict trips no KNOWN rule: the verbatim output already stands alone. Pure.
 */
export function correctionBlock(verdict: Readonly<VerifyResult>): string {
  const corrections = gateCorrections(verdict);
  if (corrections.length === 0) {
    return "";
  }
  return [
    "## How to comply (the named rewrite per violated rule)",
    "",
    ...corrections.map((correction) => correctionLine(correction)),
  ].join("\n");
}
