# Primitives

Some UI can't be plain HTML — a custom checkbox, a dialog, a menu need ARIA, focus handling and keyboard logic. vow builds a primitive **only where the browser can't do it natively**. A `<button>` is already accessible, so there is no Button primitive; a custom-styled checkbox isn't, so it earns one.

## Headless core + generated adapter

A primitive is split in two — the model is Reka UI:

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

If the core is sound against the bare platform, every adapter that merely forwards the props is sound too — so the **app never re-tests a11y**. That's the point of „agnostic": the logic hangs on nothing, and its correctness is proven once, at the bottom.

## The primitives

Each primitive has its own page — the live demo, the contract, props & events, the generated code, and its styling hooks.

| Primitive                                    | Status      | For                     |
| -------------------------------------------- | ----------- | ----------------------- |
| [Checkbox](/guide/primitives/checkbox)       | ✓ available | a boolean field         |
| [Collapsible](/guide/primitives/collapsible) | ✓ available | a disclosure / fold-out |

Climbing the ladder next — same headless-core + unstyled-adapter split, hand-rolled (no runtime lock-in): **Tabs**, **Dialog**, **Select**, … See the [Roadmap](/guide/roadmap).
