import { existsSync, readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { undocumentedPrimitives, undocumentedViewNodes } from "../src/index.ts";
import { PRIMITIVE_ADAPTERS } from "@vow/emit-primitive";
import { VIEW_NODE_TYPES } from "@vow/emit-view";
import path from "node:path";

// From packages/gate/tests up to the repo root, then into the docs guide.
const GUIDE = path.resolve(import.meta.dirname, "..", "..", "..", "docs", "guide");

/** Read every per-primitive page under `docs/guide/primitives/` (empty if the directory is absent). */
function perPrimitivePages(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => readFileSync(path.join(dir, name), "utf8"));
}

/** The primitives doc corpus — the directory page plus every per-primitive page (where a composable part
 *  like `CardBody` is named under its parent). The whole corpus is the doc source for a primitive. */
function primitivesDoc(): string {
  const directory = readFileSync(path.join(GUIDE, "primitives.md"), "utf8");
  return [directory, ...perPrimitivePages(path.join(GUIDE, "primitives"))].join("\n");
}

/** The view-node doc source — the single views page that names every placeable node. */
function viewsDoc(): string {
  return readFileSync(path.join(GUIDE, "views.md"), "utf8");
}

test("every registered primitive (PRIMITIVE_ADAPTERS) has a doc in the primitives corpus", () => {
  const names = Object.keys(PRIMITIVE_ADAPTERS);
  // Guard against a silent pass: the registry must actually have entries, or the gate is vacuous.
  expect(names.length).toBeGreaterThan(0);
  expect(undocumentedPrimitives(names, primitivesDoc())).toEqual([]);
});

test("every view-node name (VIEW_NODE_TYPES) is named in views.md", () => {
  // Guard against a silent pass: the registry must actually have entries, or the gate is vacuous.
  expect(VIEW_NODE_TYPES.length).toBeGreaterThan(0);
  expect(undocumentedViewNodes(VIEW_NODE_TYPES, viewsDoc())).toEqual([]);
});

test("the gate fires on a registered-but-undocumented primitive", () => {
  // A registry with a ghost primitive the corpus never names — exactly the ContextMenu drift.
  const names = ["Button", "GhostPrimitive"];
  const doc = "# Primitives\n\nThe [Button](/guide/primitives/button) is documented here.";
  expect(undocumentedPrimitives(names, doc)).toEqual(["GhostPrimitive"]);
});

test("the gate fires on a view-node name absent from views.md", () => {
  // `views.md` names `radio` but not `radioGroup` — the exact drift that broke the agent path.
  const types = ["list", "radioGroup"];
  const doc = "# Views\n\nPlace a `list:` or a `radio` here.";
  expect(undocumentedViewNodes(types, doc)).toEqual(["radioGroup"]);
});

test("a whole-word match does not let a parent name cover its composable part", () => {
  // `card` must not spuriously document `cardBody`: the part still earns its own mention.
  expect(undocumentedViewNodes(["cardBody"], "place a `card` here")).toEqual(["cardBody"]);
});

test("a part named only inside a longer word is not counted as documented", () => {
  // `stat` must not be covered by `stats` (a different registered element).
  expect(undocumentedPrimitives(["Stat"], "see the `Stats` strip")).toEqual(["Stat"]);
});
