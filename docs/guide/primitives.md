---
group: UI
order: 3
---

# Primitives

A primitive is one control — a checkbox, a dialog, a select. vow builds a headless core for one **only where the browser can't do it natively**: a native `<input type=checkbox>` can't be consistently styled, so a custom checkbox earns ARIA + keyboard logic atop a stylable `<button>`. A `<button>` already _is_ accessible, so [Button](/guide/primitives/button) is the one exception — a **structural** primitive with no headless core, there for the variant/theme surface.

**Variants.** Styled primitives take `variant` / `size` props, rendered as `data-variant` / `data-size` hooks the theme styles — token-driven, never concatenated class strings. See [Button](/guide/primitives/button#variants-the-vow-way).

## Headless core + generated adapter

A primitive is split in two:

- **`@vow/headless`** — the logic, framework-free. `checkbox(state, set)` returns the DOM props (`role`, `aria-checked`, key handlers) and `data-*` state hooks for each part. No Vue, no React.
- **the generated adapter** — `@vow/emit-primitive` describes the checkbox as a [`Component`](/guide/components) and renders it via the Vue adapter (`renderVueSfc`): it binds reactivity and spreads those props. A React adapter is just a different adapter over the same model.

`emit view` drops the generated `<Checkbox>` into a list for every boolean field; you never hand-write it.

## The look is vow's — and swappable

The adapter is **headless**: it carries no styling of its own, only `class` + the core's `data-*` state hooks (`data-state`, `data-disabled`). But headless doesn't mean bare — vow ships **its own base look** in **`@vow/theme`** (`vow.css`), a token-driven stylesheet that targets those hooks. So a generated app looks like vow out of the box:

- swap the tokens to re-skin everything (brand colors, radius, density) with no adapter changing;
- replace the stylesheet entirely (e.g. with the vndre.dev design tokens) for a different system over the same hooks.

The look is never the primitive's concern — it's the theme's, and it travels with vow.

## a11y is tested against the platform, not a framework

The core proves its own accessibility **in its own package**, framework-free. The test spreads the part-props onto vanilla DOM (`document.createElement`), then runs `axe` and a real `KeyboardEvent`:

```
checkbox() → part-props → vanilla DOM → axe (0 violations) + Space toggles
```

If the core is sound against the bare platform, every adapter that merely forwards the props is sound too — so the **app never re-tests a11y**. That's the point of "agnostic": the logic hangs on nothing, and its correctness is proven once, at the bottom.

## The primitives

Each primitive has its own page — the live demo, the contract, props & events, the generated code, and its styling hooks.

| Primitive                                    | Status                             | For                                                 |
| -------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| [Button](/guide/primitives/button)           | :badge[Available]{variant=success} | an action (structural)                              |
| [Badge](/guide/primitives/badge)             | :badge[Available]{variant=success} | a status / label chip (structural)                  |
| [Checkbox](/guide/primitives/checkbox)       | :badge[Available]{variant=success} | a boolean field                                     |
| [Switch](/guide/primitives/switch)           | :badge[Available]{variant=success} | a boolean as a toggle                               |
| [Collapsible](/guide/primitives/collapsible) | :badge[Available]{variant=success} | a disclosure / fold-out                             |
| [Tabs](/guide/primitives/tabs)               | :badge[Available]{variant=success} | a tablist over panels                               |
| [Dialog](/guide/primitives/dialog)           | :badge[Available]{variant=success} | a modal / drawer                                    |
| [Select](/guide/primitives/select)           | :badge[Available]{variant=success} | a listbox dropdown                                  |
| [Radio group](/guide/primitives/radio)       | :badge[Available]{variant=success} | one choice, shown inline                            |
| [Field](/guide/primitives/field)             | :badge[Available]{variant=success} | a form field (structural)                           |
| [Table](/guide/primitives/table)             | :badge[Available]{variant=success} | a data grid — composable parts (structural)         |
| [Card](/guide/primitives/card)               | :badge[Available]{variant=success} | a content surface — composable parts (structural)   |
| [Stats](/guide/primitives/stats)             | :badge[Available]{variant=success} | a metric-tile strip — composable parts (structural) |
| [Callout](/guide/primitives/callout)         | :badge[Available]{variant=success} | a tinted notice (structural)                        |

Same headless-core + unstyled-adapter split throughout, hand-rolled (no runtime lock-in). More climb the ladder as the dashboard/planning views need them — see the [Roadmap](/guide/changelog).
