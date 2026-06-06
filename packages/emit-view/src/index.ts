import type { Vow } from "@vow/core";

/**
 * vow's view emitter — `emit view` made real (CRUD over local state).
 *
 * A view renders a list of an entity's rows with create / toggle / delete, all on a local `ref`
 * (no persistence yet — a data adapter comes later). Text fields render as-is and feed the create
 * form; boolean fields render as the emitted, accessible <Checkbox>. Create/delete use native
 * <form>/<input>/<button> (no primitive needed). The view is **unstyled** — only class + data-*
 * hooks; styling lives in the swappable `@vow/theme`.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** kebab-case slug → PascalCase type name (`task` → `Task`). */
const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

/** A Vue CRUD view over an entity: typed `items` into local state, create / toggle / delete. */
export function emitViewSfc(view: Vow, entity: Vow): string {
  if (view.fulfills?.kind !== "emit" || view.fulfills.as !== "view") {
    throw new Error(`emit-view: vow "${view.slug}" is not an \`emit view\``);
  }
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: view "${view.slug}" must be \`of\` an \`emit entity\``);
  }
  const type = pascalCase(entity.slug);
  const hasBoolean = entity.fields.some((f) => f.type === "boolean");
  const inputFields = entity.fields.filter((f) => f.type !== "boolean");

  const cells = entity.fields.map((f) =>
    f.type === "boolean"
      ? `        <Checkbox v-model="item.${f.name}" label="${f.name}" />`
      : `        <span class="vow-view__field field-${f.name}">{{ item.${f.name} }}</span>`,
  );
  const inputs = inputFields.map((f) => {
    if (f.type === "select") {
      const opts = (f.options ?? []).map((o) => `<option value="${o}">${o}</option>`).join("");
      return `      <select class="vow-view__input" v-model="draft.${f.name}" aria-label="${f.name}">${opts}</select>`;
    }
    if (f.type === "date") {
      return `      <input class="vow-view__input" type="date" v-model="draft.${f.name}" aria-label="${f.name}" />`;
    }
    const model =
      f.type === "number" ? `v-model.number="draft.${f.name}"` : `v-model="draft.${f.name}"`;
    return `      <input class="vow-view__input" ${model} placeholder="${f.name}" aria-label="${f.name}" />`;
  });

  const head = [
    `<script setup lang="ts">`,
    `// Generated from vow "${view.slug}" (a view of "${entity.slug}"). The vow tree is the source — do not edit.`,
    `import { ref } from "vue";`,
    `import { create${type}, type ${type} } from "./${entity.slug}.ts";`,
  ];
  if (hasBoolean) head.push(`import Checkbox from "./Checkbox.vue";`);
  head.push(
    ``,
    `const props = defineProps<{ items: ${type}[] }>();`,
    `const rows = ref<${type}[]>(props.items.map((item) => ({ ...item })));`,
    `const draft = ref<Partial<${type}>>({});`,
    ``,
    `function add(): void {`,
    `  try {`,
    `    rows.value.push(create${type}(draft.value));`,
    `    draft.value = {};`,
    `  } catch {`,
    `    // invalid draft (e.g. a required field is empty) — ignore until we surface validation`,
    `  }`,
    `}`,
    `function remove(index: number): void {`,
    `  rows.value.splice(index, 1);`,
    `}`,
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
    `        <button class="vow-view__delete" type="button" :aria-label="'Löschen: ' + item.${inputFields[0]?.name ?? "title"}" @click="remove(i)">✕</button>`,
    `      </li>`,
    `    </ul>`,
    `    <form class="vow-view__create" @submit.prevent="add">`,
    ...inputs,
    `      <button class="vow-view__add" type="submit">+ Hinzufügen</button>`,
    `    </form>`,
    `  </section>`,
    `</template>`,
    ``,
  ].join("\n");
}

/** The PascalCase component name for an entity's default view (`task` → `Task`). */
export function viewComponentName(entity: Vow): string {
  return pascalCase(entity.slug);
}

/**
 * The default list view over an entity — no separate view vow needed. The entity is treated as its
 * own view, so a single `task.vow.md` yields the model AND its CRUD list.
 */
export function emitDefaultView(entity: Vow): string {
  return emitViewSfc(
    { ...entity, fulfills: { kind: "emit", as: "view" }, of: entity.slug },
    entity,
  );
}
