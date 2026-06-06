# Primitives

Some UI can't be plain HTML — a custom checkbox, a dialog, a menu need ARIA, focus handling and keyboard logic. vow builds a primitive **only where the browser can't do it natively**. A `<button>` is already accessible, so there is no Button primitive; a custom-styled checkbox isn't, so it earns one.

## Agnostic core + generated adapter

A primitive is split in two:

- **`@vow/headless`** — the logic, framework-free. `checkbox(state, set)` returns the DOM props (`role`, `aria-checked`, key handlers) for each part. No Vue, no React.
- **the generated adapter** — `@vow/emit-primitive` describes the checkbox as a [`Component`](/guide/components) and renders it via the Vue adapter (`renderVueSfc`): it binds reactivity and spreads those props. A React adapter is just a different adapter over the same model.

`emit view` drops the generated `<Checkbox>` into a list for every boolean field; you never hand-write it.

## a11y is tested against the platform, not a framework

The core proves its own accessibility **in its own package**, framework-free. The test spreads the part-props onto vanilla DOM (`document.createElement`), then runs `axe` and a real `KeyboardEvent`:

```
checkbox() → part-props → vanilla DOM → axe (0 violations) + Space toggles
```

If the core is sound against the bare platform, every adapter that merely forwards the props is sound too — so the **app never re-tests a11y**. That's the point of „agnostic": the logic hangs on nothing, and its correctness is proven once, at the bottom.
