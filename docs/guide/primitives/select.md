# Select

A listbox dropdown: a button that opens a list of options and commits one. It's how the framework switcher picks Vue/React/Solid, and how a form field offers a fixed set of choices that a native `<select>` can't fully style. Modelled on Reka UI and the WAI-ARIA APG select-only combobox: a `role="combobox"` button over a `role="listbox"`, with focus kept on the trigger and the highlight tracked via `aria-activedescendant`.

## See it run

The select below is the **exact** generated adapter — `emitSelectSfc()` written to a real `.vue` file at build time, running the real `@vow/headless` logic in vow's base look. Open it and use **↑/↓**, **Home/End**, **Enter** to commit, **Esc** to cancel — or click an option / click outside:

<script setup>
import { ref } from "vue";
import Select from "../../.vitepress/theme/generated/Select.vue";

const fw = ref("vue");
const options = [
  { value: "vue", label: "Vue" },
  { value: "react", label: "React" },
  { value: "solid", label: "Solid" },
];
</script>

<div :style="{ padding: '1.5rem', border: '1px solid var(--vp-c-divider)', borderRadius: '12px', margin: '1.25rem 0' }">
  <Select v-model="fw" :options="options" label="Framework" />
</div>

<p style="color: var(--vp-c-text-2)">Live reactive state: <code>fw = {{ fw }}</code>. Focus stays on the trigger; the highlighted option is tracked with <code>aria-activedescendant</code>.</p>

## The contract

The behaviour lives in the framework-free core (`@vow/headless`), conformant with the WAI-ARIA APG:

| Concern  | Rule                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| Elements | a `<button role="combobox">` over a `<ul role="listbox">` of `<li role="option">`                |
| Focus    | stays on the trigger; the highlight is tracked via `aria-activedescendant` (no per-option focus) |
| Keyboard | closed: ↓/↑/Enter/Space open; open: ↓/↑/Home/End move the highlight, Enter/Space commit          |
| Naming   | the combobox is named by `label` (combobox roles take their name from a label, not contents)     |
| Dismiss  | Escape, Tab, an outside click, or picking an option                                              |

## Props & events

| Prop         | Type                                 | Purpose                                 |
| ------------ | ------------------------------------ | --------------------------------------- |
| `modelValue` | `string`                             | the selected value — use with `v-model` |
| `options`    | `{ value: string; label: string }[]` | the choices                             |
| `label`      | `string`                             | the combobox's accessible name          |
| `disabled`   | `boolean` (optional)                 | block interaction                       |

Emits `update:modelValue: string` on commit.

## The generated adapter

This is the file vow writes — nothing here is hand-edited. The listbox renders under `v-if` (absent when closed). The keyboard + ARIA come from the core; the `setup` glue closes on an outside pointer and scrolls the active option into view. Pick a framework in the header to switch this output:

<FrameworkBlock>

<<< ../../.vitepress/theme/generated/Select.vue{vue}

</FrameworkBlock>

## Styling hooks

The adapter carries only classes and the core's `data-*` state hooks — vow's base look (`@vow/theme`) targets these (the chevron is a CSS `::after`; the highlighted row keys off `[data-active]`).

| Hook                   | Where                        | Means                               |
| ---------------------- | ---------------------------- | ----------------------------------- |
| `.vow-select`          | the wrapper `<div>`          | groups trigger + listbox            |
| `.vow-select__trigger` | the `<button role=combobox>` | the focusable trigger               |
| `.vow-select__listbox` | the `<ul role=listbox>`      | the popup (under `v-if`)            |
| `.vow-select__option`  | a `<li role=option>`         | one option                          |
| `[data-state]`         | option (+ root/trigger)      | `checked`/`unchecked` (open/closed) |
| `[data-active]`        | the highlighted option       | the keyboard highlight              |

## a11y, proven once

The core proves its own accessibility framework-free: the part-props are spread onto a vanilla combobox + listbox, then `axe` runs (0 violations) and a real **ArrowDown** moves the active option. Because every adapter merely forwards those props, the app never re-tests a11y — see [a11y is tested against the platform](/guide/primitives#a11y-is-tested-against-the-platform-not-a-framework).

## Where it appears

The doc-system's **framework switcher** (top of every page) is a `<Select>` — vow dogfooding its own primitive. Any generated app can use `<Select>` for a `select`-type field, a filter, or a settings choice.
