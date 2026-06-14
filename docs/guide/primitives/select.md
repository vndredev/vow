---
group: UI
order: 3.4
---

# Select

A listbox dropdown: a button that opens a list of options and commits one — how a `select`-type field offers a fixed set of choices that a native `<select>` can't fully style. Modelled on the WAI-ARIA APG select-only combobox: a `role="combobox"` button over a `role="listbox"`, with focus kept on the trigger and the highlight tracked via `aria-activedescendant`.

## See it run

The select below is the **exact** generated adapter — `emitSelectSfc()` written to a real `.vue` file at build time, running the real `@vow/headless` logic in vow's base look. Open it and use **↑/↓**, **Home/End**, **Enter** to commit, **Esc** to cancel — or click an option / click outside:

::: demo select
:::

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

| Prop          | Type                                     | Purpose                                                                             |
| ------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `modelValue`  | `string` (optional, default `""`)        | the selected value — use with `v-model`                                             |
| `options`     | `{ value: string; label: string }[]`     | the choices                                                                         |
| `label`       | `string`                                 | the combobox's accessible name                                                      |
| `placeholder` | `string` (optional, default `"Select…"`) | the trigger text when nothing is selected                                           |
| `controlId`   | `string` (optional)                      | the trigger's `id` — so a [`Field`](/guide/primitives/field) `<label for>` lines up |
| `describedBy` | `string` (optional)                      | an element id for the trigger's `aria-describedby` (a hint or error)                |
| `invalid`     | `boolean` (optional)                     | sets `aria-invalid` on the trigger — the error state                                |
| `disabled`    | `boolean` (optional)                     | block interaction                                                                   |

Emits `update:modelValue: string` on commit. `controlId` / `describedBy` / `invalid` let a [`## form`](/guide/emit) wire the select into a `Field` — its label, description, and validation — like any other control.

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

The live demo above is the exact generated adapter — and the one a [`## form`](/guide/emit) wires in: every `select` field and every `reference` field (a dropdown over the target entity's items) renders as a `<Select>`. You can also place one in a `## view` directly, for a filter or a settings choice.
