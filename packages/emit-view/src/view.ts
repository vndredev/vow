import type { Component, ImportDecl, ReadonlyVow, UiNode } from "./types.ts";
import { PRIMITIVES, componentsIn, mapNode } from "./map-node.ts";
import { pascalCase, renderVueSfc } from "@vow/component";
import { defined } from "@vow/core";

/** The import path for a referenced component — Icon comes from @vow/icons, the rest from `.generated/`. */
function importFor(name: string): ImportDecl {
  if (name === "Icon") {
    return { default: name, from: "@vow/icons/Icon.vue" };
  }
  return { default: name, from: `./${name}.vue` };
}

/** A `## view` mapped ONCE: the rendered SFC + the primitives it references. planView needs both, so this
 *  avoids mapping the node tree twice (emitView + referencedPrimitives each re-mapped it). */
export function buildView(
  view: ReadonlyVow,
  entities: readonly string[] = [],
): { readonly primitives: string[]; readonly sfc: string } {
  if (!defined(view.view)) {
    throw new Error(`emit-view: vow "${view.slug}" has no \`## view\``);
  }
  const nodes = view.view.map((node) => mapNode(node.type, node.value, entities));
  const root: UiNode = {
    attrs: [
      { kind: "static", name: "class", value: "vow-app" },
      // The page's spec source — the picker (the in-app bug reporter) walks up to the nearest
      // `data-vow-source` to name which vow a clicked element came from. Only vow can map DOM → spec.
      { kind: "static", name: "data-vow-source", value: view.slug },
    ],
    children: nodes,
    kind: "element",
    tag: "div",
  };
  const referenced = [...componentsIn(root)];
  const component: Component = {
    doc: [
      `Generated from vow "${view.slug}" (a \`## view\`). The vow is the source — do not edit.`,
    ],
    imports: referenced.map((name) => importFor(name)),
    name: pascalCase(view.slug),
    view: root,
  };
  return {
    primitives: referenced.filter((name) => PRIMITIVES.includes(name)),
    sfc: renderVueSfc(component),
  };
}

/** The primitives a `## view` references directly — so the plugin can materialise each adapter on demand. */
export function referencedPrimitives(
  view: ReadonlyVow,
  entities: readonly string[] = [],
): string[] {
  if (!defined(view.view)) {
    return [];
  }
  return buildView(view, entities).primitives;
}

/**
 * A view from a YAML `## view` — a list of components rendered to a Vue SFC, wrapped in a `vow-app`
 * root. `entities` are the entity slugs a `list:` may reference; every `<Component>` in the result
 * (primitives + referenced views) is imported from its `.generated/` `.vue`.
 */
export function emitView(view: ReadonlyVow, entities: readonly string[] = []): string {
  return buildView(view, entities).sfc;
}

/**
 * A prose page from already-rendered markdown nodes (see `@vow/markdown` `markdownToNodesSync`). The
 * nodes are wrapped in a `vow-doc` container; any embedded `<Component>` is imported from its generated
 * `.vue`. The markdown file is the source — this is generated. Lets the docs be a vow app whose content
 * stays as plain `.md` (scanned by the plugin), rendered through the core, not a parallel doc-system.
 */
export function emitProse(slug: string, nodes: readonly UiNode[]): string {
  const root: UiNode = {
    attrs: [
      { kind: "static", name: "class", value: "vow-doc" },
      { kind: "static", name: "data-vow-source", value: slug },
    ],
    children: [...nodes],
    kind: "element",
    tag: "div",
  };
  const component: Component = {
    doc: [
      `Generated prose page "${slug}" (from markdown). The markdown is the source — do not edit.`,
    ],
    imports: [...componentsIn(root)].map((name) => importFor(name)),
    name: pascalCase(slug),
    view: root,
  };
  return renderVueSfc(component);
}
