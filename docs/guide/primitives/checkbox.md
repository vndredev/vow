---
group: UI
order: 1.1
---

# Checkbox

A boolean field, rendered as an accessible custom checkbox. A native `<input type="checkbox">` can't be fully or consistently styled, so this primitive earns its place: modelled on Reka UI, the control is a `<button role="checkbox">` that reproduces the native semantics — `role`, `aria-checked`, keyboard — over an element you _can_ style. `emit view` drops it into a list for every boolean field, so you never hand-write it.

## See it run

The boxes below are the **exact** generated adapter — `emitCheckboxSfc()` is written to a real `.vue` file at build time and imported here, running the real `@vow/headless` logic dressed in vow's own base look (`@vow/theme`). Click a box, or focus it and press **Space**:

::: demo checkbox
:::

## The contract

The behaviour lives in the framework-free core (`@vow/headless`), conformant with the WAI-ARIA APG:

| Concern  | Rule                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| Element  | the control is a `<button type="button" role="checkbox">`                                |
| State    | `aria-checked` reflects the value; `data-state="checked \| unchecked"` is the style hook |
| Keyboard | **Space** toggles; **Enter** never does (and is prevented, as on a real checkbox)        |
| Disabled | the native button `disabled` — out of the tab order, inert; `data-disabled` for styling  |

## Props & events

Derived from the adapter's `Component` definition — the same shape you see in the generated code below:

| Prop         | Type                 | Purpose                                         |
| ------------ | -------------------- | ----------------------------------------------- |
| `modelValue` | `boolean`            | the checked state — use with `v-model`          |
| `label`      | `string`             | visible text, and the control's `aria-label`    |
| `disabled`   | `boolean` (optional) | block interaction and remove from the tab order |

Emits `update:modelValue: boolean` on every toggle.

## Styling hooks

The adapter carries only classes and the core's `data-*` state hooks, never a color or size — vow's base look (`@vow/theme`) targets these, and swapping the theme re-skins it without the adapter changing.

| Hook                       | Where                        | Means                   |
| -------------------------- | ---------------------------- | ----------------------- |
| `.vow-checkbox`            | the wrapper `<span>`         | groups control + label  |
| `.vow-checkbox__control`   | the `<button role=checkbox>` | the focusable control   |
| `.vow-checkbox__indicator` | the inner `<span>`           | the check mark          |
| `.vow-checkbox__label`     | the text `<span>`            | the label               |
| `[data-state]`             | every part                   | `checked` / `unchecked` |
| `[data-disabled]`          | wrapper + control            | drives the dimmed look  |

## a11y, proven once

The core proves its own accessibility framework-free: the part-props are spread onto a vanilla `<button>`, then `axe` runs (0 violations) and a real **Space** `KeyboardEvent` must toggle. Because every adapter merely forwards those props, the app never re-tests a11y — see [a11y is tested against the platform](/guide/primitives#a11y-is-tested-against-the-platform-not-a-framework).

## Where it appears

`emit view` renders a `<Checkbox>` for every boolean field of an entity in its list — so a `done: boolean` field becomes a working, accessible checkbox with no extra vow.
