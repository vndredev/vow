---
group: UI
order: 3.3
---

# Dialog

A modal: content that takes over the screen until dismissed, over a backdrop. It's how a search panel or a confirm box opens, and how the mobile nav slides in. Modelled on the WAI-ARIA APG: a `role="dialog"` `aria-modal` content over a dismiss overlay, with **Escape** to close and a **Tab focus-trap** so focus can't leave while it's open.

## See it run

The dialog below is the **exact** generated adapter — `emitDialogSfc()` written to a real `.vue` file at build time, running the real `@vow/headless` logic in vow's base look. Open it, then try **Esc**, **Tab** (focus stays inside), clicking the backdrop, or the close button:

::: demo dialog
:::

## The contract

The behaviour lives in the framework-free core (`@vow/headless`), conformant with the WAI-ARIA APG:

| Concern        | Rule                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| Elements       | a `<div role="dialog" aria-modal="true">` content over a dismiss overlay               |
| Open           | controlled by `v-model` — the dialog owns no trigger (any host button opens it)        |
| Keyboard       | **Escape** closes; **Tab** / **Shift+Tab** are trapped within the content (wrapping)   |
| Dismiss        | Escape, an overlay click, or the close button                                          |
| Wiring         | the content `aria-labelledby` its title (auto via `useId()`)                           |
| Focus & scroll | focus moves into the content on open and returns on close; body scroll locks (adapter) |

## Props, events & slots

| Prop / slot  | Type      | Purpose                                       |
| ------------ | --------- | --------------------------------------------- |
| `modelValue` | `boolean` | the open state — use with `v-model`           |
| `title`      | `string`  | the heading, and the dialog's accessible name |
| _(default)_  | slot      | the dialog body                               |

Emits `update:modelValue: boolean` when dismissed.

## Styling hooks

The adapter carries only classes and the core's `data-*` state hooks — vow's base look (`@vow/theme`) targets these.

| Hook                   | Where                    | Means                        |
| ---------------------- | ------------------------ | ---------------------------- |
| `.vow-dialog`          | the Teleported container | fixed, full-screen, centers  |
| `.vow-dialog__overlay` | the backdrop             | the scrim (click to dismiss) |
| `.vow-dialog__content` | the `<div role=dialog>`  | the modal box                |
| `.vow-dialog__title`   | the `<h2>`               | the heading                  |
| `.vow-dialog__close`   | the close `<button>`     | the dismiss control          |
| `[data-state]`         | overlay + content        | `open` / `closed`            |

## a11y, proven once

The core proves its own accessibility framework-free: the part-props are spread onto a vanilla `role="dialog"`, then `axe` runs (0 violations), a real **Escape** closes, and **Tab** wraps focus at both ends. Because every adapter merely forwards those props, the app never re-tests a11y — see [a11y is tested against the platform](/guide/primitives#a11y-is-tested-against-the-platform-not-a-framework).

## Where it appears

The doc-system's **search panel** and **mobile navigation** are Dialogs — vow dogfooding its primitive. Any generated app can use `<Dialog>` for confirms, forms, or command palettes.
