import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadVows, parseVowMd, uncoveredScenarios, type Vow } from "@vow/core";
import { entityProves } from "@vow/emit-entity";
import { allVows, generateFiles } from "@vow/vite-plugin";

/**
 * vow's scenario-coverage gate — the tor that keeps a promise from going unproven.
 *
 * `runGate` generates first (so `.generated/` tests exist — this also solves generate-before-test),
 * then checks that every scenario promised across the whole vow tree has a matching test in the
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

/** Generate, then check coverage of every promised scenario across the vows. */
export function runGate(opts: {
  readonly vowDir: string;
  readonly outDir: string;
  readonly testRoots: readonly string[];
}): GateResult {
  const vows = loadVows(opts.vowDir);
  generateFiles(vows, opts.outDir, opts.vowDir); // generate-before-test
  const expected = allVows(vows).flatMap(expectedScenarios);
  const testNames = collectTestNames(opts.testRoots);
  return { expected, uncovered: uncoveredScenarios(expected, testNames) };
}

/**
 * The docs-drift gate — the tor that keeps the prose honest.
 *
 * Every ```markdown fence in the docs/README that looks like a vow.md (has a `fulfills:` line) is a
 * promise about how the format works. We re-parse each one through the *real* core, so a stale
 * example — wrong id shape, dropped field syntax, a removed emit target — fails a test instead of
 * silently misleading a reader. Drift becomes a red build, not a surprise.
 */

/** The emit targets the generator actually knows; an example naming any other has drifted. */
const KNOWN_EMIT_TARGETS: readonly string[] = ["entity", "view", "form"];

/** Extract every fenced ```markdown block that looks like a vow.md (carries a `fulfills:` line). */
export function vowExamplesIn(source: string): string[] {
  return [...source.matchAll(/```markdown\n([\s\S]*?)```/g)]
    .map((m) => m[1] ?? "")
    .filter((block) => /^fulfills:/m.test(block));
}

/** Validate one doc example against the real core; returns a drift reason, or `null` if it holds. */
export function checkVowExample(content: string): string | null {
  let vow: Vow;
  try {
    vow = parseVowMd("example", content);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const f = vow.fulfills;
  if (f?.kind === "emit" && !KNOWN_EMIT_TARGETS.includes(f.as)) {
    return `unknown emit target "${f.as}" — known: ${KNOWN_EMIT_TARGETS.join(", ")}`;
  }
  return null;
}

/**
 * The type-drift gate — keeps the docs' type examples honest against the real code.
 *
 * `components.md` documents the `Attr`/`UiNode` discriminant kinds and `emit.md` lists the field
 * types — both are claims about the code. We read the real kinds off the Vue adapter's `switch` arms
 * and the field types off the core's `FieldType` enum, then check the docs mention each one. So adding
 * a kind or a field type without updating the prose fails a test instead of drifting silently.
 */

/** The discriminant kinds the Vue adapter handles — read off its `case "<kind>":` switch arms. */
export function adapterKinds(renderVueSource: string): string[] {
  return [...renderVueSource.matchAll(/case "([a-z]+)":/g)].map((m) => m[1] ?? "");
}

/** Adapter kinds not mentioned (as `"<kind>"`) in the component-model doc — drift. */
export function undocumentedKinds(renderVueSource: string, docSource: string): string[] {
  return adapterKinds(renderVueSource).filter((k) => !docSource.includes(`"${k}"`));
}

/** The field types the core enumerates — read off `FieldType = z.enum([...])`. */
export function coreFieldTypes(coreSource: string): string[] {
  const m = /FieldType = z\.enum\(\[([^\]]+)\]\)/.exec(coreSource);
  return m?.[1] ? [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1] ?? "") : [];
}

/** Field types not mentioned (as `` `<type>` `` or `<type>(`) in the emit doc — drift. */
export function undocumentedFieldTypes(coreSource: string, docSource: string): string[] {
  return coreFieldTypes(coreSource).filter(
    (t) => !docSource.includes(`\`${t}\``) && !docSource.includes(`${t}(`),
  );
}

/**
 * The language gate — the codebase and docs are English-only.
 *
 * Returns the distinct German-language markers (umlauts and the sharp-s) in a source. They are an
 * unambiguous "not English" signal and don't collide with the intentional glyphs (check/cross) or
 * em-dashes the emitters use. The character class is written with unicode escapes so this file
 * itself stays ASCII and passes its own gate.
 */
/** Char codes for the German umlauts + sharp-s, plus the German low-9 opening quote (U+201E `„`,
 *  distinctly German — English curly quotes are not flagged). Listed as numbers so this file stays ASCII. */
const GERMAN_MARKER_CODES = new Set([228, 246, 252, 223, 196, 214, 220, 8222]);

export function germanMarkers(source: string): string[] {
  const found = new Set<string>();
  for (let i = 0; i < source.length; i += 1) {
    if (GERMAN_MARKER_CODES.has(source.charCodeAt(i))) found.add(source.charAt(i));
  }
  return [...found];
}

/**
 * German prose slips through the umlaut scan when it has no umlauts ("ab 10 greift der Rabatt"). This
 * is a curated set of German function words that effectively never appear as whole words in English
 * source — deliberately conservative (no `die`/`war`/`den`/`mit`/`von`, which collide with English or
 * acronyms) — so a German sentence is caught by its connective tissue without false positives.
 */
const GERMAN_WORDS = new Set([
  "und",
  "oder",
  "nicht",
  "eine",
  "einen",
  "einem",
  "einer",
  "wird",
  "werden",
  "wurde",
  "sind",
  "sein",
  "haben",
  "hatte",
  "dass",
  "weil",
  "wenn",
  "aber",
  "auch",
  "sich",
  "noch",
  "schon",
  "nur",
  "kann",
  "muss",
  "soll",
  "durch",
  "greift",
  "rabatt",
]);

/** Distinct German words in a source (lowercased whole-word match) — a "not English" signal. */
export function germanWords(source: string): string[] {
  const found = new Set<string>();
  for (const word of source.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (GERMAN_WORDS.has(word)) found.add(word);
  }
  return [...found];
}
