import { allVows, generateFiles } from "@vow/vite-plugin";
import {
  defined,
  isEmit,
  loadVows,
  mapDefined,
  parseVowMd,
  uncoveredScenarios,
} from "@vow/core/node";
import { formProves, viewProves } from "@vow/emit-view";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { entityProves } from "@vow/emit-entity";
import path from "node:path";

/**
 * Vow's scenario-coverage gate — the tor that keeps a promise from going unproven.
 *
 * `runGate` generates first (so `.generated/` tests exist — this also solves generate-before-test),
 * then checks that every scenario promised across the whole vow tree has a matching test in the
 * corpus. Any uncovered claim is an unproven promise, so the caller fails the gate.
 *
 * HONEST LIMIT: this is NAMING-coverage, not behavioral-coverage. `collectTestNames` scans test
 * sources for `test("<name>")` strings — it never executes them. So the gate proves a test NAMED
 * after each claim exists, not that the test runs or asserts anything. For `emit` vows that is
 * enough (the same emitter writes both the claim and a real body, in lock-step). For the `bind` path
 * the body is hand-written, so a green name here means "a test of this name exists", NOT "the bound
 * behaviour is proven" — the author still owns writing a test that actually exercises the symbol.
 *
 * The `@vow/core` types are derived from the value imports rather than imported as types: a value +
 * type pair from one module is forbidden by the import rules, and a separate type-only import would
 * duplicate the module. `Maybe` is defined locally for the same reason.
 */

/** A value that may be absent — the explicit name for `T | undefined`, narrowed via `defined`. */
type Maybe<T> = T | undefined;

/** The absent value — a typed stand-in produced without writing the forbidden `undefined` literal
 *  (an unset optional property reads back as the absence at runtime). */
const { absent }: { readonly absent?: never } = {};

/** Deep-readonly: every property, at every depth and through arrays, becomes readonly. */
type DeepReadonly<T> = T extends (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

/** The parsed vow node — the shape the (zod-mutable) emit API still asks for. */
type Vow = ReturnType<typeof parseVowMd>;

/** A vow, read-only to its leaves — the parameter shape every read helper accepts. */
type ReadonlyVow = DeepReadonly<Vow>;

/**
 * Rebuild a read-only vow into the mutable `Vow` the emit API still asks for. The emit layer reads
 * only — but its parameter type is the plain (zod-mutable) `Vow`, so a `ReadonlyVow` is not
 * assignable. A fresh structural copy bridges the seam without a cast and without lying: the gate
 * hands the emitter its own array, never aliasing the read-only input.
 */
function widen(vow: ReadonlyVow): Vow {
  return {
    ...vow,
    children: vow.children.map(widen),
    fields: vow.fields.map((field) => ({
      ...field,
      options: mapDefined(field.options, (set) => [...set]),
    })),
    proof: vow.proof.map((scenario) => ({ ...scenario })),
    seed: mapDefined(vow.seed, (set) => set.map((record) => ({ ...record }))),
    view: mapDefined(vow.view, (set) => [...set]),
  };
}

/** The scenarios a vow promises: derived for `emit entity`, authored (`## proves`) otherwise. For a form,
 *  `byId` resolves its bound entity to decide whether the incomplete-submit scenario applies — it does not
 *  for an all-optional entity (an empty submit validates cleanly, so no error to assert). */
export function expectedScenarios(
  vow: ReadonlyVow,
  entities: readonly ReadonlyVow[] = [],
): string[] {
  if (isEmit(vow, "entity")) {
    return entityProves(widen(vow));
  }
  if (isEmit(vow, "view")) {
    return [...vow.proof.map((scenario) => scenario.claim), ...viewProves(widen(vow))];
  }
  if (isEmit(vow, "form")) {
    const target = vow.form?.of ?? "";
    const entity = entities.find((candidate) => candidate.slug === target);
    const hasRequired = entity?.fields.some((field) => field.required) ?? false;
    return [
      ...vow.proof.map((scenario) => scenario.claim),
      ...viewProves(widen(vow)),
      ...formProves(widen(vow), hasRequired, vow.form?.edit === true),
    ];
  }
  return vow.proof.map((scenario) => scenario.claim);
}

/** The capture group holding the body of a single-group match (group 0 is the whole match). */
const BODY_GROUP = 1;

/** The `test`/`it` name matcher: a quote, then a lazy body, then the same quote (groups 1 and 2). */
const TEST_NAME = /(?:test|it)\(\s*(["'`])(.*?)\1/gu;

/** The capture group holding the test name (group 1 is the opening quote). */
const TEST_NAME_GROUP = 2;

/** Every `test("…")` / `it("…")` name in a test source (the name may contain other quote chars). */
export function testNamesIn(source: string): string[] {
  return [...source.matchAll(TEST_NAME)].map(
    (match: readonly string[]) => match[TEST_NAME_GROUP] ?? "",
  );
}

/** A `*.test.ts(x)` file name. */
const TEST_FILE = /\.test\.tsx?$/u;

/** The entry names directly under `dir`, or an empty list if the directory is missing. */
export function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** Recursively collect test names from every `*.test.ts(x)` under the given roots. */
export function collectTestNames(roots: readonly string[]): string[] {
  const names: string[] = [];
  const walk = (dir: string): void => {
    for (const name of safeReaddir(dir)) {
      const child = path.join(dir, name);
      if (statSync(child).isDirectory()) {
        walk(child);
      } else if (TEST_FILE.test(name)) {
        names.push(...testNamesIn(readFileSync(child, "utf8")));
      }
    }
  };
  for (const root of roots) {
    walk(root);
  }
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
  // Generate before test, so the `.generated/` suites exist for the corpus scan.
  generateFiles(vows, { outDir: opts.outDir, srcDir: opts.vowDir });
  const all = allVows(vows);
  const expected = all.flatMap((vow: ReadonlyVow) => expectedScenarios(vow, all));
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

/** A fenced ```markdown block (group 1 is its body). */
const MARKDOWN_FENCE = /```markdown\n([\s\S]*?)```/gu;

/** A `fulfills:` line at the start of a line — the marker of a vow.md example. */
const FULFILLS_LINE = /^fulfills:/mu;

/** Extract every fenced ```markdown block that looks like a vow.md (carries a `fulfills:` line). */
export function vowExamplesIn(source: string): string[] {
  return [...source.matchAll(MARKDOWN_FENCE)]
    .map((match: readonly string[]) => match[BODY_GROUP] ?? "")
    .filter((block) => FULFILLS_LINE.test(block));
}

/** Parse a doc example, returning the vow or the parse error's message (the first drift reason). */
function parseExample(content: string): Vow | string {
  try {
    return parseVowMd("example", content);
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

/** Validate one doc example against the real core; returns a drift reason, or absent if it holds. */
export function checkVowExample(content: string): Maybe<string> {
  const parsed = parseExample(content);
  if (typeof parsed === "string") {
    return parsed;
  }
  const { fulfills } = parsed;
  if (fulfills?.kind === "emit" && !KNOWN_EMIT_TARGETS.includes(fulfills.as)) {
    return `unknown emit target "${fulfills.as}" — known: ${KNOWN_EMIT_TARGETS.join(", ")}`;
  }
  // The example holds: no drift to report.
  return absent;
}

/**
 * The type-drift gate — keeps the docs' type examples honest against the real code.
 *
 * `components.md` documents the `Attr`/`UiNode` discriminant kinds and `emit.md` lists the field
 * types — both are claims about the code. We read the real kinds off the Vue adapter's dispatch and
 * the field types off the core's `FieldType` enum, then check the docs mention each one. So adding a
 * kind or a field type without updating the prose fails a test instead of drifting silently.
 *
 * The adapter dispatches kinds two ways: `Attr` kinds via `case "<kind>":` switch arms (render-attr),
 * `UiNode` kinds via `node.kind === "<kind>"` comparisons (render-node). Both forms are read, so the
 * gate covers the whole discriminant surface — not just the half a single regex happens to match.
 */

/**
 * A `case "<kind>":` switch arm OR a `.kind === "<kind>"` comparison — group 1 is the discriminant
 * kind. The adapter dispatches `Attr` kinds the first way (render-attr) and `UiNode` kinds the second
 * (render-node), so one regex covers the whole discriminant surface.
 */
const KIND_DISPATCH = /(?:case "([a-z]+)":|\.kind === "([a-z]+)")/gu;

/** The capture group for the `.kind === "<kind>"` form (the switch-arm form is group 1). */
const COMPARISON_GROUP = 2;

/**
 * The discriminant kinds the Vue adapter handles — read off both its `case "<kind>":` switch arms and
 * its `node.kind === "<kind>"` comparisons, de-duplicated. Pass the adapter's render sources
 * (render-attr + render-node); a single source covers only the dispatch form it happens to use.
 */
export function adapterKinds(...renderSources: readonly string[]): string[] {
  const kinds = renderSources.flatMap((source) =>
    [...source.matchAll(KIND_DISPATCH)].map(
      (match: readonly string[]) => match[BODY_GROUP] ?? match[COMPARISON_GROUP] ?? "",
    ),
  );
  return [...new Set(kinds)];
}

/** Adapter kinds not mentioned (as `"<kind>"`) in the component-model doc — drift. */
export function undocumentedKinds(renderSources: readonly string[], docSource: string): string[] {
  return adapterKinds(...renderSources).filter((kind) => !docSource.includes(`"${kind}"`));
}

/** The `FieldType = z.enum([...])` declaration — group 1 is the bracketed list. */
const FIELD_TYPE_ENUM = /FieldType = z\.enum\(\[([^\]]+)\]\)/u;

/** A quoted lowercase token — group 1 is the bare type name. */
const QUOTED_TOKEN = /"([a-z]+)"/gu;

/** The field types the core enumerates — read off `FieldType = z.enum([...])`. */
export function coreFieldTypes(coreSource: string): string[] {
  const match = FIELD_TYPE_ENUM.exec(coreSource);
  const list = match?.[BODY_GROUP];
  if (defined(list)) {
    return [...list.matchAll(QUOTED_TOKEN)].map(
      (token: readonly string[]) => token[BODY_GROUP] ?? "",
    );
  }
  return [];
}

/** Field types not mentioned (as `` `<type>` `` or `<type>(`) in the emit doc — drift. */
export function undocumentedFieldTypes(coreSource: string, docSource: string): string[] {
  return coreFieldTypes(coreSource).filter(
    (type) => !docSource.includes(`\`${type}\``) && !docSource.includes(`${type}(`),
  );
}

/**
 * The has-a-doc gate — every shipped package carries a doc entry.
 *
 * `packages.md` is the package directory: every `@vow/*` package, its role, and where to learn it. A new
 * package shipped without a row there is an element with no doc — exactly the drift this catches, so adding
 * a package without documenting it fails a test instead of leaving the directory silently stale.
 */

/** The `@vow/*` names (prefix stripped) not mentioned (as `` `@vow/<name>` ``) in the packages doc — each
 *  is an undocumented, shipped element. */
export function undocumentedPackages(names: readonly string[], docSource: string): string[] {
  return names.filter((name) => !docSource.includes(`\`@vow/${name}\``));
}

/**
 * The docs-coverage gate — every registered element carries a doc.
 *
 * The has-a-doc gate above proves every shipped *package* has a row. This proves the next layer down:
 * every *element* the generator can place. Two closed registries name vow's built vocabulary —
 * `PRIMITIVE_ADAPTERS` (the PascalCase primitive SFC adapters) and `VIEW_NODE_TYPES` (the camelCase
 * `## view` node names). The author + agent paths validate against them: `emit view` rejects a `## view`
 * node not in the set, and the `add_view` MCP tool publishes the names and validates writes against them.
 * So a name in either registry is a contract — and a contract with no doc is exactly the drift the audit
 * found shipped UNGATED (a fully-registered, themed `ContextMenu` primitive with no page; `views.md`
 * naming the node `radio` while the registry calls it `radioGroup`, which BREAKS the agent path).
 *
 * The check mirrors `undocumentedPackages`: an element is documented when its registry name appears as a
 * whole word in its doc source — the primitives corpus for a primitive (its page heading, its directory
 * row, a `` `Name` `` part mention in its parent's page), and `views.md` for a view-node name. A whole-word
 * match (not a substring) keeps `card` from spuriously covering `cardBody`, so a composable part still
 * earns its own mention. Adding a registered element without documenting it fails a test, not a reader.
 */

/** A whole-word matcher for `name` — bounded by non-word chars (or the string edges), case-sensitive so a
 *  PascalCase primitive isn't matched by an unrelated lowercased word. The name is regex-escaped (the
 *  registry names are plain identifiers, but escaping keeps the matcher safe against any future entry). */
function mentionsWord(source: string, name: string): boolean {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(String.raw`(?<![\w-])${escaped}(?![\w-])`, "u").test(source);
}

/** The registered primitive names not mentioned (as a whole word) anywhere in the primitives doc corpus —
 *  each is a built, themed element with no page or directory row. Pass `Object.keys(PRIMITIVE_ADAPTERS)`. */
export function undocumentedPrimitives(names: readonly string[], docSource: string): string[] {
  return names.filter((name) => !mentionsWord(docSource, name));
}

/** The view-node type names not mentioned (as a whole word) in the views doc — each is a node an author or
 *  the `add_view` tool may place that the page never names (the `radio`/`radioGroup` drift). Pass
 *  `VIEW_NODE_TYPES`. */
export function undocumentedViewNodes(types: readonly string[], docSource: string): string[] {
  return types.filter((type) => !mentionsWord(docSource, type));
}

/**
 * The language gate — the codebase and docs are English-only.
 *
 * Returns the distinct German-language markers (umlauts and the sharp-s) in a source. They are an
 * unambiguous "not English" signal and don't collide with the intentional glyphs (check/cross) or
 * em-dashes the emitters use. The character class is written with unicode code points so this file
 * itself stays ASCII and passes its own gate.
 */

/** The lowercase a-umlaut code point. */
const A_UMLAUT = 228;
/** The lowercase o-umlaut code point. */
const O_UMLAUT = 246;
/** The lowercase u-umlaut code point. */
const U_UMLAUT = 252;
/** The sharp-s (eszett) code point. */
const SHARP_S = 223;
/** The capital A-umlaut code point. */
const CAP_A_UMLAUT = 196;
/** The capital O-umlaut code point. */
const CAP_O_UMLAUT = 214;
/** The capital U-umlaut code point. */
const CAP_U_UMLAUT = 220;
/** The German low-9 opening quote (U+201E) — distinctly German; English curly quotes are not flagged. */
const LOW_NINE_QUOTE = 8222;

/**
 * Char codes for the German umlauts + sharp-s, plus the German low-9 opening quote. Listed as named
 * code points so this file stays ASCII.
 */
const GERMAN_MARKER_CODES = new Set([
  A_UMLAUT,
  O_UMLAUT,
  U_UMLAUT,
  SHARP_S,
  CAP_A_UMLAUT,
  CAP_O_UMLAUT,
  CAP_U_UMLAUT,
  LOW_NINE_QUOTE,
]);

export function germanMarkers(source: string): string[] {
  const found = new Set<string>();
  for (const char of source) {
    const code = char.codePointAt(0);
    if (defined(code) && GERMAN_MARKER_CODES.has(code)) {
      found.add(char);
    }
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

/** A run of ASCII letters — a candidate word for the German-word scan. */
const WORD = /[a-z]+/gu;

/** Distinct German words in a source (lowercased whole-word match) — a "not English" signal. */
export function germanWords(source: string): string[] {
  const found = new Set<string>();
  for (const word of source.toLowerCase().match(WORD) ?? []) {
    if (GERMAN_WORDS.has(word)) {
      found.add(word);
    }
  }
  return [...found];
}
