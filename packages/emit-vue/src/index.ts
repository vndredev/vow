import type { Vow } from "@vow/core";

/**
 * vow's Vue emitter — the `emit` fulfilment made real.
 *
 * Turns an `emit` vow into a Vue SFC string. Minimal but genuinely valid Vue: a component that
 * renders the vow's intent. This is what `virtual:vow/component/<slug>` serves — generated on
 * load, never written to disk. Richer emission (props, children, Reka components) grows from here.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** kebab-case slug → PascalCase component name (`welcome-card` → `WelcomeCard`). */
const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

/** Emit a Vue SFC from an `emit` vow. Fails fast if the vow isn't an `emit` fulfilment. */
export function emitVueSfc(vow: Vow): string {
  if (vow.fulfills?.kind !== "emit") {
    throw new Error(`emitVueSfc: vow "${vow.slug}" has no \`emit\` fulfilment`);
  }
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
