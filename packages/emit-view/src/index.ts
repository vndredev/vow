import type { Vow } from "@vow/core";

/**
 * vow's view emitter — `emit view` made real (read-only for now).
 *
 * A view renders a list of an entity's rows. `emitViewSfc` produces a typed Vue SFC: it imports the
 * entity's type and renders each field as plain HTML + your tokens (Stufe 0 — no headless primitive).
 * Interaction (checkbox toggle, create dialog, delete) grows from here.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** kebab-case slug → PascalCase type name (`task` → `Task`). */
const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

/** A read-only Vue view over an entity: a typed `items` prop, one row per item, plain HTML. */
export function emitViewSfc(view: Vow, entity: Vow): string {
  if (view.fulfills?.kind !== "emit" || view.fulfills.as !== "view") {
    throw new Error(`emit-view: vow "${view.slug}" is not an \`emit view\``);
  }
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: view "${view.slug}" must be \`of\` an \`emit entity\``);
  }
  const type = pascalCase(entity.slug);
  const cells = entity.fields.map((f) => {
    const expr = f.type === "boolean" ? `item.${f.name} ? '✓' : '–'` : `item.${f.name}`;
    return `        <span class="field-${f.name}">{{ ${expr} }}</span>`;
  });
  return [
    `<script setup lang="ts">`,
    `// Generated from vow "${view.slug}" (a view of "${entity.slug}"). The vow tree is the source — do not edit.`,
    `import type { ${type} } from "./${entity.slug}.ts";`,
    `defineProps<{ items: ${type}[] }>();`,
    `</script>`,
    ``,
    `<template>`,
    `  <section class="vow-view-${view.slug}">`,
    `    <h1>${escapeHtml(view.intent)}</h1>`,
    `    <ul>`,
    `      <li v-for="(item, i) in items" :key="i">`,
    ...cells,
    `      </li>`,
    `    </ul>`,
    `  </section>`,
    `</template>`,
    ``,
  ].join("\n");
}
