---
group: UI
order: 3.95
---

# Callout

A **notice** — a tip, an info, a warning, a danger. `Callout` is **structural** (no headless core), the reusable form of the markdown `:::` blocks: a tinted, left-bordered panel with an optional title and your content in the slot.

## See it run

::: demo callout
:::

## Props

| Prop      | Type                                       | Purpose                         |
| --------- | ------------------------------------------ | ------------------------------- |
| `variant` | `'tip' \| 'info' \| 'warning' \| 'danger'` | the tint; defaults to `info`    |
| `title`   | `string` (optional)                        | a bold lead line; absent → none |

## Styling hooks

| Hook                  | Where           | Means                                 |
| --------------------- | --------------- | ------------------------------------- |
| `.vow-callout`        | the `<div>`     | the tinted panel                      |
| `.vow-callout__title` | the title `<p>` | the bold lead                         |
| `[data-variant]`      | the `<div>`     | `tip` / `info` / `warning` / `danger` |

## No a11y core — on purpose

Callout is structural — a styled `<div>`, no `@vow/headless` logic. The tint is decorative; the message reads as plain text to a screen reader. See [primitives](/guide/primitives).
