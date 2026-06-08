---
group: UI
order: 3.5
---

# Tabs

A tablist: a row of tabs over panels, where one panel shows at a time — how a settings screen splits into sections, or a wizard steps through panels. Modelled on Reka UI and the WAI-ARIA APG: `role="tablist"` of `role="tab"` buttons over `role="tabpanel"` regions, with **roving focus** (arrow keys move selection _and_ focus).

## See it run

The tabs below are the **exact** generated adapter — `emitTabsSfc()` written to a real `.vue` file at build time, running the real `@vow/headless` logic in vow's base look. Click a tab, or focus one and press **←/→** (Home/End jump to the ends):

::: demo tabs
:::

## The contract

The behaviour lives in the framework-free core (`@vow/headless`), conformant with the WAI-ARIA APG:

| Concern      | Rule                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| Elements     | a `role="tablist"` of `<button role="tab">` over `<div role="tabpanel">` regions              |
| Selection    | `aria-selected` on the active tab; `data-state="active \| inactive"` is the style hook        |
| Roving focus | only the active tab is tabbable (`tabindex` 0, the rest -1); **←/→** (or **↑/↓**), Home, End  |
| Wiring       | each tab `aria-controls` its panel; each panel `aria-labelledby` its tab (auto via `useId()`) |
| Orientation  | `data-orientation` / `aria-orientation`, default `horizontal`                                 |

## Props, events & slots

| Prop / slot  | Type       | Purpose                                              |
| ------------ | ---------- | ---------------------------------------------------- |
| `modelValue` | `string`   | the selected tab's value — use with `v-model`        |
| `items`      | `string[]` | the ordered tab values (also the visible tab labels) |
| `#<value>`   | slot       | one named slot per item holds that panel's content   |

Emits `update:modelValue: string` on every change.

## Styling hooks

The adapter carries only classes and the core's `data-*` state hooks — vow's base look (`@vow/theme`) targets these (the active tab gets an underline via `[data-state="active"]`).

| Hook                 | Where                    | Means                      |
| -------------------- | ------------------------ | -------------------------- |
| `.vow-tabs`          | the wrapper `<div>`      | groups list + panels       |
| `.vow-tabs__list`    | the `<div role=tablist>` | the row of tabs            |
| `.vow-tabs__tab`     | a `<button role=tab>`    | one tab                    |
| `.vow-tabs__panel`   | a `<div role=tabpanel>`  | one panel (under `v-show`) |
| `[data-state]`       | tabs + panels            | `active` / `inactive`      |
| `[data-orientation]` | wrapper                  | `horizontal` / `vertical`  |

## a11y, proven once

The core proves its own accessibility framework-free: the part-props are spread onto a vanilla tablist, then `axe` runs (0 violations) and a real **ArrowRight** moves both selection and focus to the next tab. Because every adapter merely forwards those props, the app never re-tests a11y — see [a11y is tested against the platform](/guide/primitives#a11y-is-tested-against-the-platform-not-a-framework).

## Where it appears

The live demo above is the exact generated adapter. Any generated app can use `<Tabs>` for settings sections, dashboards, or wizards. _(The docs' own `::: code-group` switcher is a separate, simpler hand-rolled tablist — not this primitive.)_
