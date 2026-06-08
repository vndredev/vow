---
group: UI
order: 3.8
---

# Radio group

A single choice from a small set, shown all at once — the inline, always-visible alternative to a [Select](/guide/primitives/select) dropdown. Native radios can't be consistently styled and need real roving-focus keyboard logic, so this primitive earns its place: modelled on Reka UI, a `role="radiogroup"` of `role="radio"` buttons with the WAI-ARIA semantics over elements you _can_ style.

## See it run

::: demo radio
:::

Click an option, or focus one and press the **arrow keys** — focus moves _and_ selects, wrapping at the ends.

## The contract

The behaviour lives in the framework-free core (`@vow/headless`), conformant with the WAI-ARIA APG:

| Concern  | Rule                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Element  | a `role="radiogroup"` wrapping `<button type="button" role="radio">` options                                                     |
| State    | `aria-checked` per option; `data-state="checked \| unchecked"` is the hook                                                       |
| Keyboard | **roving focus** — only the checked option (or the first) is tabbable; **arrows** move + select, wrapping; **Home**/**End** jump |
| Disabled | the native button `disabled`; `data-disabled` styles the group                                                                   |

## Props & events

| Prop         | Type                 | Purpose                                  |
| ------------ | -------------------- | ---------------------------------------- |
| `modelValue` | `string` (optional)  | the selected option — use with `v-model` |
| `options`    | `string[]`           | the choices, in order                    |
| `label`      | `string`             | the group's `aria-label`                 |
| `disabled`   | `boolean` (optional) | block interaction                        |

Emits `update:modelValue: string` on every change.

## Styling hooks

| Hook                 | Where                      | Means                              |
| -------------------- | -------------------------- | ---------------------------------- |
| `.vow-radio`         | the group `<div>`          | the `role=radiogroup` stack        |
| `.vow-radio__option` | each `<button role=radio>` | a choice                           |
| `.vow-radio__dot`    | the inner `<span>`         | the radio dot (fills when checked) |
| `.vow-radio__label`  | the text `<span>`          | the option label                   |
| `[data-state]`       | each option                | `checked` / `unchecked`            |
| `[data-disabled]`    | group + options            | the dimmed look                    |

## a11y, proven once

The core proves its own accessibility framework-free: the part-props are spread onto vanilla buttons, then `axe` runs (0 violations) and a real **ArrowDown** `KeyboardEvent` must move the selection. Every adapter merely forwards those props — see [a11y is tested against the platform](/guide/primitives#a11y-is-tested-against-the-platform-not-a-framework).

## Radio or Select?

Both pick one value from an enum. Reach for a **Radio group** for a few options you want visible at once; a **Select** when the list is long or space is tight. vow renders a `select` field as a Select dropdown by default — RadioGroup is for when you place one in a view directly.
