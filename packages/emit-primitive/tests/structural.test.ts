import {
  emitBadgeSfc,
  emitButtonSfc,
  emitCalloutSfc,
  emitCardBodySfc,
  emitCardHeaderSfc,
  emitCardSfc,
  emitFieldSfc,
  emitStatSfc,
  emitStatsSfc,
  emitTableCellSfc,
  emitTableHeadSfc,
  emitTableRowSfc,
  emitTableSfc,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";

// The byte-stable oracle for the button adapter: a structural <button> with the variant/size hooks
// + the default slot (label fallback). No headless import — it carries no logic, only the surface.
const EXPECTED_BUTTON = [
  `<script setup lang="ts">`,
  `// Generated button — the one structural control with NO headless core (<button> is accessible).`,
  `// Carries the design-language surface (variant·tone·size·density data-* hooks); the look lives in @vow/theme.`,
  `import Icon from "@vow/icons/Icon.vue";`,
  `import { type IconName } from "@vow/icons";`,
  ``,
  `const props = withDefaults(defineProps<{ label?: string; icon?: IconName; variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'link'; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; density?: 'comfortable' | 'compact'; type?: 'button' | 'submit' }>(), { label: '', variant: 'solid', tone: 'accent', size: 'md', density: 'comfortable', type: 'button' });`,
  `</script>`,
  ``,
  `<template>`,
  `  <button class="vow-button" :type="type" :data-variant="variant" :data-tone="tone" :data-size="size" :data-density="density">`,
  `    <Icon v-if="icon" :name="icon" />`,
  `    <slot>{{ label }}</slot>`,
  `  </button>`,
  `</template>`,
  ``,
].join("\n");

test("emitButtonSfc renders the structural button adapter byte-for-byte", () => {
  const sfc = emitButtonSfc();
  expect(sfc).toBe(EXPECTED_BUTTON);
  // No headless core — it's structural.
  expect(sfc).not.toContain("@vow/headless");
  expect(sfc).not.toContain("<style");
});

const EXPECTED_BADGE = [
  `<script setup lang="ts">`,
  `// Generated badge — a structural status/label chip (no headless core; it's inert text).`,
  `// Carries the design-language surface (variant·tone data-* hooks); the look lives in @vow/theme.`,
  `import Icon from "@vow/icons/Icon.vue";`,
  `import { type IconName } from "@vow/icons";`,
  ``,
  `const props = withDefaults(defineProps<{ label?: string; icon?: IconName; variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'link'; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' }>(), { label: '', variant: 'soft', tone: 'neutral' });`,
  `</script>`,
  ``,
  `<template>`,
  `  <span class="vow-badge" :data-variant="variant" :data-tone="tone">`,
  `    <Icon v-if="icon" :name="icon" />`,
  `    <slot>{{ label }}</slot>`,
  `  </span>`,
  `</template>`,
  ``,
].join("\n");

test("emitBadgeSfc renders the structural badge adapter byte-for-byte", () => {
  const sfc = emitBadgeSfc();
  expect(sfc).toBe(EXPECTED_BADGE);
  // Structural — no logic.
  expect(sfc).not.toContain("@vow/headless");
  expect(sfc).not.toContain("<style");
});

const EXPECTED_TABLE = [
  `<script setup lang="ts">`,
  `// Generated table — a structural data grid over native <table> (no headless core).`,
  `</script>`,
  ``,
  `<template>`,
  `  <table class="vow-table">`,
  `    <slot />`,
  `  </table>`,
  `</template>`,
  ``,
].join("\n");

const EXPECTED_TABLE_HEAD = [
  `<script setup lang="ts">`,
  `// Generated table header cell (<th>) — structural; the caller sets \`scope\` via fall-through.`,
  `</script>`,
  ``,
  `<template>`,
  `  <th class="vow-table__head">`,
  `    <slot />`,
  `  </th>`,
  `</template>`,
  ``,
].join("\n");

const EXPECTED_TABLE_CELL = [
  `<script setup lang="ts">`,
  `// Generated table cell (<td>) — structural, class hook only.`,
  `</script>`,
  ``,
  `<template>`,
  `  <td class="vow-table__cell">`,
  `    <slot />`,
  `  </td>`,
  `</template>`,
  ``,
].join("\n");

test("the table parts render byte-for-byte as structural primitives", () => {
  expect(emitTableSfc()).toBe(EXPECTED_TABLE);
  expect(emitTableHeadSfc()).toBe(EXPECTED_TABLE_HEAD);
  expect(emitTableCellSfc()).toBe(EXPECTED_TABLE_CELL);
  // Symmetric with the others.
  expect(emitTableRowSfc()).toContain(`<tr class="vow-table__row">`);
  for (const sfc of [emitTableSfc(), emitTableRowSfc(), emitTableHeadSfc(), emitTableCellSfc()]) {
    // Structural — no logic.
    expect(sfc).not.toContain("@vow/headless");
    expect(sfc).not.toContain("<style");
  }
});

const EXPECTED_CARD = [
  `<script setup lang="ts">`,
  `// Generated card — a structural bordered content surface (no headless core).`,
  `</script>`,
  ``,
  `<template>`,
  `  <div class="vow-card">`,
  `    <slot />`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

const EXPECTED_CARD_HEADER = [
  `<script setup lang="ts">`,
  `// Generated card header — structural, class hook only (a title row + optional actions).`,
  `</script>`,
  ``,
  `<template>`,
  `  <div class="vow-card__header">`,
  `    <slot />`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

test("the card parts render byte-for-byte as structural primitives", () => {
  expect(emitCardSfc()).toBe(EXPECTED_CARD);
  expect(emitCardHeaderSfc()).toBe(EXPECTED_CARD_HEADER);
  // Symmetric with the others.
  expect(emitCardBodySfc()).toContain(`<div class="vow-card__body">`);
  for (const sfc of [emitCardSfc(), emitCardHeaderSfc(), emitCardBodySfc()]) {
    expect(sfc).not.toContain("@vow/headless");
    expect(sfc).not.toContain("<style");
  }
});

const EXPECTED_STAT = [
  `<script setup lang="ts">`,
  `// Generated stat tile — a value + label metric (structural, no headless).`,
  ``,
  `const props = defineProps<{ value: string | number; label: string }>();`,
  `</script>`,
  ``,
  `<template>`,
  `  <div class="vow-stat">`,
  `    <span class="vow-stat__value">{{ value }}</span>`,
  `    <span class="vow-stat__label">{{ label }}</span>`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

test("the data-display parts (stats, callout) render byte-for-byte as structural primitives", () => {
  expect(emitStatSfc()).toBe(EXPECTED_STAT);
  expect(emitStatsSfc()).toContain(`<div class="vow-stats">`);
  expect(emitCalloutSfc()).toContain(`<div class="vow-callout" :data-variant="variant">`);
  expect(emitCalloutSfc()).toContain(`<p v-if="title" class="vow-callout__title">{{ title }}</p>`);
  for (const sfc of [emitStatSfc(), emitStatsSfc(), emitCalloutSfc()]) {
    expect(sfc).not.toContain("@vow/headless");
    expect(sfc).not.toContain("<style");
  }
});

// The byte-stable oracle for the field wrapper: label + slotted control + description + error.
// Structural, no headless — its a11y is the emitted markup (label `for`, error `role=alert`).
const EXPECTED_FIELD = [
  `<script setup lang="ts">`,
  `// Generated field wrapper — a label + control + optional description and error. No headless core:`,
  `// pure structure + a11y wiring (label \`for\`, error \`role=alert\`); the look lives in @vow/theme.`,
  ``,
  `const props = defineProps<{ label: string; controlId: string; description?: string; error?: string }>();`,
  `</script>`,
  ``,
  `<template>`,
  `  <div class="vow-field">`,
  `    <label class="vow-field__label" :for="controlId">{{ label }}</label>`,
  `    <slot />`,
  `    <p class="vow-field__desc" v-if="description">{{ description }}</p>`,
  `    <p class="vow-field__error" :id="controlId + '-error'" role="alert" v-if="error">{{ error }}</p>`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

test("emitFieldSfc renders the structural field wrapper byte-for-byte", () => {
  const sfc = emitFieldSfc();
  expect(sfc).toBe(EXPECTED_FIELD);
  // Structural — no headless core.
  expect(sfc).not.toContain("@vow/headless");
  expect(sfc).not.toContain("<style");
});
