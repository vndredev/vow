import type { Component, ReadonlyVow, UiNode } from "./types.ts";
import { assertEmitEntity, selectField } from "./entity-guard.ts";
import { pascalCase, renderVueSfc } from "@vow/component";
import { errorMessage } from "./status-message.ts";
import { scriptJson } from "./helpers.ts";
import { statsComponentName } from "./naming.ts";

/** The `<Stats>` composition — one `<Stat>` per option, bound to the per-group count computed. */
function statsBlock(): UiNode {
  return {
    attrs: [],
    children: [
      {
        attrs: [
          { expr: "s.value", kind: "bound", name: "value" },
          { expr: "s.label", kind: "bound", name: "label" },
        ],
        children: [],
        for: { as: "s", each: "stats", key: "s.label" },
        kind: "component",
        name: "Stat",
      },
    ],
    kind: "component",
    name: "Stats",
  };
}

/** The whole stats view — the `<Stats>` block plus the error branch. All-zero stats from a dead API are
 *  indistinguishable from a genuinely empty dataset, so a `.vow-empty` "Couldn't load this data" surfaces
 *  a failed fetch (`state.error && rows.length === 0`) — a failed fetch is never rendered as zero records. */
function statsView(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-view" }],
    children: [
      statsBlock(),
      errorMessage("state.error && rows.length === 0", "Couldn't load this data"),
    ],
    kind: "element",
    tag: "section",
  };
}

/**
 * A stats composition over an entity — one `<Stat>` per option of a `select` field, counting the rows
 * in that group (live from the shared store). A composition, not a primitive: it knows the entity's
 * field + binds the store; it composes the `Stats`/`Stat` primitives.
 */
export function emitEntityStats(entity: ReadonlyVow, by: string): string {
  assertEmitEntity(entity, "stats");
  const field = selectField(entity, by, "stats");
  const type = pascalCase(entity.slug);
  const component: Component = {
    doc: [
      `Generated from vow "${entity.slug}" — a count of rows per ${by}. The vow is the source — do not edit.`,
    ],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["useCollection"] },
      { from: `./${entity.slug}.ts`, names: [`type ${type}`] },
      { default: "Stats", from: "./Stats.vue" },
      { default: "Stat", from: "./Stat.vue" },
    ],
    name: statsComponentName(entity.slug, by),
    setup: [
      `const { items: rows, state } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
      `const options = ${scriptJson(field.options ?? [])};`,
      `const stats = computed(() =>`,
      `  options.map((o) => ({ label: o, value: rows.filter((r) => r.${by} === o).length })),`,
      `);`,
    ],
    view: statsView(),
  };
  return renderVueSfc(component);
}
