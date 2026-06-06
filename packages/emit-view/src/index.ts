import type { Vow } from "@vow/core";

/**
 * vow's view emitter — `emit view` made real.
 *
 * A view renders a list of an entity's rows. Text fields render as-is; boolean fields render as the
 * emitted, accessible <Checkbox>. The view holds local state and is **unstyled** — it carries only
 * BEM-ish class hooks (`vow-view`, `vow-view__row`, …). Styling lives in the swappable `@vow/theme`,
 * so the list runs bare and the design system layers on without touching the generated markup.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** kebab-case slug → PascalCase type name (`task` → `Task`). */
const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

/** A Vue view over an entity: a typed `items` prop into local state, one hooked row per item. */
export function emitViewSfc(view: Vow, entity: Vow): string {
  if (view.fulfills?.kind !== "emit" || view.fulfills.as !== "view") {
    throw new Error(`emit-view: vow "${view.slug}" is not an \`emit view\``);
  }
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: view "${view.slug}" must be \`of\` an \`emit entity\``);
  }
  const type = pascalCase(entity.slug);
  const hasBoolean = entity.fields.some((f) => f.type === "boolean");
  const cells = entity.fields.map((f) =>
    f.type === "boolean"
      ? `        <Checkbox v-model="item.${f.name}" label="${f.name}" />`
      : `        <span class="vow-view__field field-${f.name}">{{ item.${f.name} }}</span>`,
  );
  const head = [
    `<script setup lang="ts">`,
    `// Generated from vow "${view.slug}" (a view of "${entity.slug}"). The vow tree is the source — do not edit.`,
    `import { ref } from "vue";`,
    `import type { ${type} } from "./${entity.slug}.ts";`,
  ];
  if (hasBoolean) head.push(`import Checkbox from "./Checkbox.vue";`);
  head.push(
    ``,
    `const props = defineProps<{ items: ${type}[] }>();`,
    `const rows = ref<${type}[]>(props.items.map((item) => ({ ...item })));`,
    `</script>`,
  );
  return [
    ...head,
    ``,
    `<template>`,
    `  <section class="vow-view vow-view--${view.slug}">`,
    `    <h1 class="vow-view__title">${escapeHtml(view.intent)}</h1>`,
    `    <ul class="vow-view__list">`,
    `      <li class="vow-view__row" v-for="(item, i) in rows" :key="i">`,
    ...cells,
    `      </li>`,
    `    </ul>`,
    `  </section>`,
    `</template>`,
    ``,
  ].join("\n");
}
