---
group: UI
order: 3.05
---

# Badge

A small **status or label chip** — `Backlog`, `Done`, `Blocked`. Like [Button](/guide/primitives/button), it's **structural**: inert text with no headless core. It carries the one thing the bare element can't — a `variant` surface the theme colours — plus an optional leading icon.

## See it run

::: demo badge
:::

## Props

| Prop      | Type                                                          | Purpose                                                       |
| --------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `label`   | `string` (optional)                                           | the chip text — the default slot's fallback                   |
| `icon`    | `IconName` (optional)                                         | a leading [`@vow/icons`](/guide/primitives/button#icon) glyph |
| `variant` | `'neutral' \| 'accent' \| 'success' \| 'warning' \| 'danger'` | the status colour; defaults to `neutral`                      |

Place one in a `## view`: `- badge: { label: Done, variant: success, icon: check }`.

## Styling hooks

The chip carries only a class + the variant hook — each variant is a soft tint (`color-mix`) of a semantic token, so it re-skins with the theme.

| Hook             | Where        | Means                                                   |
| ---------------- | ------------ | ------------------------------------------------------- |
| `.vow-badge`     | the `<span>` | the chip box                                            |
| `[data-variant]` | the `<span>` | `neutral` / `accent` / `success` / `warning` / `danger` |

## No a11y core — on purpose

Badge is inert text — there's no interaction to prove, so no `@vow/headless` logic and no `*.a11y.test.ts`. It reads as plain text to a screen reader (the colour is decorative). See [primitives](/guide/primitives).
