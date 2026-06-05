import type { Vow } from "@vow/core";

/**
 * vow's Vue emitter — the `emit` fulfilment made real.
 *
 *  - `emitVueModule` → a runnable, compiled Vue component module (what the virtual module serves,
 *    runs as-is through Vite/Rolldown — vow owns the whole pipeline, no plugin-vue in the path).
 *  - `emitVueSfc`    → the readable Vue SFC (for `vow eject` / human-owned output).
 *
 * Both are generated on load, never written to disk. Richer emission (props, children, Reka
 * components) grows from here.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** kebab-case slug → PascalCase component name (`welcome-card` → `WelcomeCard`). */
const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

function ensureEmit(vow: Vow): void {
  if (vow.fulfills?.kind !== "emit") {
    throw new Error(`emit-vue: vow "${vow.slug}" has no \`emit\` fulfilment`);
  }
}

/** A runnable Vue component module emitted from an `emit` vow — the compiled form, runs as-is. */
export function emitVueModule(vow: Vow): string {
  ensureEmit(vow);
  const name = pascalCase(vow.slug);
  const cls = JSON.stringify(`vow-${vow.slug}`);
  return [
    `import { defineComponent, h } from "vue";`,
    ``,
    `export default defineComponent({`,
    `  name: ${JSON.stringify(name)},`,
    `  render() {`,
    `    return h("section", { class: ${cls} }, [h("p", ${JSON.stringify(vow.intent)})]);`,
    `  },`,
    `});`,
    ``,
  ].join("\n");
}

/** The readable Vue SFC for `vow eject` — human-owned output, never in the live path. */
export function emitVueSfc(vow: Vow): string {
  ensureEmit(vow);
  const name = pascalCase(vow.slug);
  return [
    `<script setup lang="ts">`,
    `// Generated from vow "${vow.slug}". The vow tree is the source — do not edit.`,
    `defineOptions({ name: ${JSON.stringify(name)} });`,
    `</script>`,
    ``,
    `<template>`,
    `  <section class="vow-${vow.slug}">`,
    `    <p>${escapeHtml(vow.intent)}</p>`,
    `  </section>`,
    `</template>`,
    ``,
  ].join("\n");
}
