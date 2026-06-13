import {
  designLanguageViolations,
  emittedClasses,
  themedClasses,
  unverifiableCount,
} from "../src/design-language.ts";
import { expect, test } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** One emitter source to scan, as `designLanguageViolations` takes them (derived, so no type-only import). */
type EmitterSource = Parameters<typeof designLanguageViolations>[0][number];

/** The count of `vow-view vow-view--${slug}` modifiers the emitters build by interpolation today. */
const KNOWN_DYNAMIC_CLASSES = 2;

/* The emitter packages whose every `vow-*` class must be defined in the design language. These
   are the two that write element classes — emit-view (the entity/issue/loop/trace SFCs) + emit-primitive
   (the button/badge/table/… atoms). A class one of them emits with no matching rule is bespoke unstyled
   markup (the `.vow-loop__metric` that shipped flat text), which this gate forbids. */
const EMIT_PACKAGES = ["emit-view", "emit-primitive"];

/** The packages root (sibling to this gate package). */
const PACKAGES = path.resolve(import.meta.dirname, "..", "..");

/** Read every emitter `.ts` source across the emit packages, keyed package-qualified (`<pkg>/<name>`) so a
 *  reported violation names exactly its file, never every same-named file across packages. */
function emitterSources(): EmitterSource[] {
  const sources: EmitterSource[] = [];
  for (const pkg of EMIT_PACKAGES) {
    const srcDir = path.join(PACKAGES, pkg, "src");
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

/* The design-language stylesheets, in layer order — the shared `@vow/theme` (primitives + app look), then
   the consumer layers that style their own emitted classes on top of the same tokens: `@vow/docs` (the
   prose `.vow-doc`) and `@vow/shell` (the `.vow-shell*` chrome). An emitted class is themed if ANY of them
   defines it, so a doc-layer class isn't a false miss against the theme alone. (See doc-system.md: "every
   rule lives in one of the two stylesheets, and each consumer package ships its own CSS".) */
const STYLESHEETS: readonly string[] = [
  path.join(PACKAGES, "theme", "vow.css"),
  path.join(PACKAGES, "docs", "src", "style.css"),
  path.join(PACKAGES, "shell", "src", "style.css"),
];

/** The real design language — the union of the layer stylesheets, concatenated for the selector scan. */
function designLanguage(): string {
  return STYLESHEETS.map((file) => readFileSync(file, "utf8")).join("\n");
}

test("every class the emitters write is defined in the design language (the layer stylesheets)", () => {
  expect(designLanguageViolations(emitterSources(), designLanguage())).toEqual([]);
});

test("the gate catches a bespoke unthemed class (so an unstyled markup bypass can't pass silently)", () => {
  const planted: EmitterSource[] = [
    { file: "drift.ts", source: '{ kind: "static", name: "class", value: "vow-loop__metric" }' },
  ];
  // The class has no `.vow-loop__metric` rule in the real stylesheet — exactly the #642 drift.
  expect(designLanguageViolations(planted, designLanguage())).toEqual([
    { file: "drift.ts", token: "vow-loop__metric" },
  ]);
});

test("a compound class value splits into its individual themed tokens", () => {
  const found = emittedClasses('classed("table", "vow-table vow-issue-table", [])');
  expect(found.tokens).toContain("vow-table");
  expect(found.tokens).toContain("vow-issue-table");
});

test("a `.vow-block__el` rule defines the block, so a namespace base is themed", () => {
  // The base `vow-issue-table` carries no own rule — it composes on `.vow-table` and only its elements
  // (`.vow-issue-table__num`) are styled. The block prefix counts as themed through its elements.
  const themed = themedClasses(".vow-issue-table__num { color: gray; }");
  expect(themed.has("vow-issue-table")).toBe(true);
  expect(themed.has("vow-issue-table__num")).toBe(true);
});

test("a kebab continuation does NOT theme a sibling element (the `__` boundary is exact)", () => {
  /* A `.vow-trace__detail-text` rule must not theme `vow-trace__detail` — `-text` is a name continuation,
     not a separate `__` element, so the cell class still needs its own rule. */
  const themed = themedClasses(".vow-trace__detail-text { color: gray; }");
  expect(themed.has("vow-trace__detail")).toBe(false);
});

test("an interpolated class tail is counted as unverifiable, never reported as a static class", () => {
  /* The fixture is `vow-view vow-view--${slug}`: `vow-view` is static + themed; the `vow-view--…` modifier
     is built at runtime, so it is COUNTED (no-silent-caps), never reported as the dangling `vow-view--`. */
  // oxlint-disable-next-line no-template-curly-in-string -- a literal `${…}` is the source-under-test fixture
  const found = emittedClasses("`vow-view vow-view--${entity.slug}`");
  expect(found.tokens).toEqual(["vow-view"]);
  expect(found.unverifiable).toBe(1);
});

test("the real emit trees' dynamic classes are a known, tracked count (no silent caps)", () => {
  /* Today exactly the two view-list modifiers (entity-cards + entity-list) are built by interpolation —
     their static base (`vow-view`) IS enforced, the runtime tail is counted, not silently dropped. If a
     future emitter adds another interpolated class, this number rises and the gate surfaces the gap. */
  expect(unverifiableCount(emitterSources())).toBe(KNOWN_DYNAMIC_CLASSES);
});

test("a `vow-` class named only in a JSDoc comment is not collected (comments are documentation)", () => {
  const found = emittedClasses("/** wraps nodes in a `vow-doc` container */ const x = 1;");
  expect(found.tokens).toEqual([]);
});
