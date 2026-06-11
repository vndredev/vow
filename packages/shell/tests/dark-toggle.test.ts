import { expect, test } from "vite-plus/test";
import { emitDarkToggleSfc } from "../src/index.ts";
import path from "node:path";
import { readFileSync } from "node:fs";

/* The byte-stable oracle for the dark-toggle chrome: rendered from a canonical @vow/component, never as
   a raw Vue string — so a React/Solid adapter renders the same tree. Pins the exact rendered SFC; a render
   change is a red test, not silent drift. */
const EXPECTED_DARK_TOGGLE = [
  `<script setup lang="ts">`,
  `// Generated dark-toggle chrome through @vow/component — do not edit. Logic lives in use-theme.ts.`,
  `// Carries class hooks only; vow's base look lives in @vow/theme (swappable).`,
  `import Icon from "@vow/icons/Icon.vue";`,
  `import { useTheme } from "./use-theme.ts";`,
  ``,
  `const { theme, icon, cycle } = useTheme();`,
  `</script>`,
  ``,
  `<template>`,
  `  <button type="button" class="vow-shell__theme" :aria-label="\`Theme: \${theme}\`" :title="\`Theme: \${theme} — click to change\`" @click="cycle">`,
  `    <Icon :name="icon" />`,
  `    <span class="vow-shell__theme-label">{{ theme }}</span>`,
  `  </button>`,
  `</template>`,
  ``,
].join("\n");

test("emitDarkToggleSfc renders the dark-toggle chrome byte-for-byte", () => {
  expect(emitDarkToggleSfc()).toBe(EXPECTED_DARK_TOGGLE);
});

/* Collapse insignificant whitespace (oxfmt wraps long attr lists across lines, and drops the closing `>`
   onto its own line) so the committed `.vue` and the model's render can be compared for sameness without
   coupling to the formatter's line breaks. */
function normalise(sfc: string): string {
  return sfc.replaceAll(/\s+/gu, " ").replaceAll(/\s+>/gu, ">").trim();
}

test("the shipped dark-toggle.vue is the model's render (only the formatter's line wrapping differs)", () => {
  const onDisk = readFileSync(path.resolve(import.meta.dirname, "../src/dark-toggle.vue"), "utf8");
  expect(normalise(onDisk)).toBe(normalise(emitDarkToggleSfc()));
});
