---
group: UI
order: 1.2
---

# Collapsible

A disclosure: a button that expands and collapses a region of content. It's how the sidebar groups fold, and how an FAQ row opens. Modelled on Reka UI — the trigger is a real `<button>` (so the keyboard contract is native: Space/Enter toggles), and the two parts are wired with `aria-expanded` / `aria-controls` / `aria-labelledby`.

## See it run

The panels below are the **exact** generated adapter — `emitCollapsibleSfc()` written to a real `.vue` file at build time, running the real `@vow/headless` logic in vow's base look. Click a header, or focus it and press **Space**:

<script setup>
import { ref } from "vue";
import Collapsible from "../../.studio/generated/Collapsible.vue";

const what = ref(true);
const how = ref(false);
</script>

<div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem', border: '1px solid var(--vow-color-border)', borderRadius: '12px', margin: '1.25rem 0' }">
  <Collapsible v-model="what" label="What is a vow?">
    <p style="margin: 0; color: var(--vow-color-muted)">A promise about your app's behaviour — an intent plus the proof that redeems it.</p>
  </Collapsible>
  <Collapsible v-model="how" label="How is its status known?">
    <p style="margin: 0; color: var(--vow-color-muted)">It's derived, never stored: a vow is fulfilled when its proof scenarios have green tests.</p>
  </Collapsible>
  <Collapsible :model-value="false" label="Locked (disabled)" disabled>
    <p style="margin: 0; color: var(--vow-color-muted)">You can't open this one.</p>
  </Collapsible>
</div>

<p style="color: var(--vow-color-muted)">Live reactive state: <code>what = {{ what }}</code> · <code>how = {{ how }}</code>. The disabled header ignores click and Space — that rule lives in the core, not the theme.</p>

## The contract

The behaviour lives in the framework-free core (`@vow/headless`), conformant with the WAI-ARIA APG:

| Concern  | Rule                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- |
| Elements | trigger is a `<button type="button">`; content is a `<div role="region">`                     |
| State    | `aria-expanded` on the trigger; `data-state="open \| closed"` is the style hook (every part)  |
| Keyboard | the native button — **Space** / **Enter** toggle; nothing custom (only build what HTML can't) |
| Wiring   | `aria-controls` ↔ content `id`, `aria-labelledby` ↔ trigger `id` (auto via `useId()`)         |
| Disabled | the native button `disabled`; `data-disabled` for styling                                     |

## Props & events

| Prop         | Type                 | Purpose                             |
| ------------ | -------------------- | ----------------------------------- |
| `modelValue` | `boolean`            | the open state — use with `v-model` |
| `label`      | `string`             | the trigger text                    |
| `disabled`   | `boolean` (optional) | block toggling and dim the control  |

Emits `update:modelValue: boolean` on every toggle.

## The generated adapter

This is the file vow writes — nothing here is hand-edited. The content region renders under `v-show`, so it stays mounted (the theme can animate it) and only its visibility toggles. Pick a framework in the header to switch this output:

<FrameworkBlock>

<<< ../../.studio/generated/Collapsible.vue{vue}

</FrameworkBlock>

## Styling hooks

The adapter carries only classes and the core's `data-*` state hooks — vow's base look (`@vow/theme`) targets these (e.g. the chevron is a CSS `::after` that rotates on `[data-state="open"]`).

| Hook                        | Where                   | Means                    |
| --------------------------- | ----------------------- | ------------------------ |
| `.vow-collapsible`          | the wrapper `<div>`     | groups trigger + content |
| `.vow-collapsible__trigger` | the `<button>`          | the disclosure trigger   |
| `.vow-collapsible__content` | the `<div role=region>` | the collapsible body     |
| `[data-state]`              | every part              | `open` / `closed`        |
| `[data-disabled]`           | wrapper + trigger       | drives the dimmed look   |

## a11y, proven once

The core proves its own accessibility framework-free: the part-props are spread onto a vanilla `<button>` + region, then `axe` runs (0 violations) and a real click toggles. Because every adapter merely forwards those props, the app never re-tests a11y — see [a11y is tested against the platform](/guide/primitives#a11y-is-tested-against-the-platform-not-a-framework).

## Where it appears

The doc-system's own **sidebar groups** are Collapsibles — vow dogfooding its primitive. Any generated app can use `<Collapsible>` for FAQ rows, settings sections, or a navigation tree.
