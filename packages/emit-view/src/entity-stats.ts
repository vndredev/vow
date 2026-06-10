import type { Component, ReadonlyVow } from "./types.ts";
import { assertEmitEntity, selectField } from "./entity-guard.ts";
import { pascalCase, renderVueSfc } from "@vow/component";
import { statsComponentName } from "./naming.ts";

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
      `const { items: rows } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
      `const options = ${JSON.stringify(field.options ?? [])};`,
      `const stats = computed(() =>`,
      `  options.map((o) => ({ label: o, value: rows.filter((r) => r.${by} === o).length })),`,
      `);`,
    ],
    view: {
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
    },
  };
  return renderVueSfc(component);
}
