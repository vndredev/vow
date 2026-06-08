---
group: UI
order: 1.7
---

# Switch

A boolean as an on/off **toggle** — a pill track with a sliding thumb. HTML has no stylable native switch, so this primitive earns its place: modelled on Reka UI, the control is a `<button role="switch">` that carries the WAI-ARIA semantics over an element you _can_ style. It's the toggle-flavoured sibling of the [Checkbox](/guide/primitives/checkbox).

## See it run

The toggles below are the **exact** generated adapter — `emitSwitchSfc()` written to a real `.vue` file at build time, running the real `@vow/headless` logic. Click one, or focus it and press **Space** or **Enter**:

::: demo switch
:::

## The contract

The behaviour lives in the framework-free core (`@vow/headless`), conformant with the WAI-ARIA APG:

| Concern  | Rule                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- |
| Element  | the control is a `<button type="button" role="switch">`                                        |
| State    | `aria-checked` reflects the value; `data-state="checked \| unchecked"` is the hook             |
| Keyboard | **Space** and **Enter** both toggle (and are prevented, so the native click can't double-fire) |
| Disabled | the native button `disabled` — out of the tab order, inert; `data-disabled` styles it          |

## Props & events

| Prop         | Type                 | Purpose                                         |
| ------------ | -------------------- | ----------------------------------------------- |
| `modelValue` | `boolean` (optional) | the on/off state — use with `v-model`           |
| `label`      | `string`             | visible text, and the control's `aria-label`    |
| `disabled`   | `boolean` (optional) | block interaction and remove from the tab order |

Emits `update:modelValue: boolean` on every toggle.

## Styling hooks

| Hook                   | Where                      | Means                                      |
| ---------------------- | -------------------------- | ------------------------------------------ |
| `.vow-switch`          | the wrapper `<span>`       | groups control + label                     |
| `.vow-switch__control` | the `<button role=switch>` | the pill track                             |
| `.vow-switch__thumb`   | the inner `<span>`         | the sliding thumb                          |
| `.vow-switch__label`   | the text `<span>`          | the label                                  |
| `[data-state]`         | each part                  | `checked` / `unchecked` (the thumb slides) |
| `[data-disabled]`      | wrapper + control          | the dimmed look                            |

## a11y, proven once

The core proves its own accessibility framework-free: the part-props are spread onto a vanilla `<button>`, then `axe` runs (0 violations) and a real **Space** `KeyboardEvent` must toggle. Every adapter merely forwards those props, so the app never re-tests it — see [a11y is tested against the platform](/guide/primitives#a11y-is-tested-against-the-platform-not-a-framework).

## Checkbox or Switch?

Both are a boolean. Reach for a **Checkbox** when the value is part of a form to submit (a list of options); a **Switch** when toggling it takes effect immediately (a setting). vow renders a boolean field as a Checkbox by default — Switch is for when you place one in a view directly.
