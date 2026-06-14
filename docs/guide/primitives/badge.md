---
group: UI
order: 3.05
---

# Badge

A small **status or label chip** — `Backlog`, `Done`, `Blocked`. Like [Button](/guide/primitives/button), it's **structural**: inert text with no headless core. It carries the two design-language axes a label reads — a **`tone`** (the semantic colour) and a **`variant`** (the treatment over it) — plus an optional leading icon. A badge has no `size`/`density`: it reads one scale.

## See it run

::: demo badge
:::

## The axes

A badge takes the two colour axes of vow's [design language](/guide/design); the size/density axes don't apply (a badge is one scale).

- **`tone`** — the semantic colour: `neutral` (default) · `accent` · `success` · `warning` · `danger` · `info`. A status reads its tone from its **meaning**, never a swatch — `done → success`, `blocked → danger`.
- **`variant`** — the treatment over the tone: `soft` (the default tint) · `solid` · `outline` · `ghost` · `link`.

## Props

| Prop      | Type                                                                    | Purpose                                                       |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `label`   | `string` (optional)                                                     | the chip text — the default slot's fallback                   |
| `icon`    | `IconName` (optional)                                                   | a leading [`@vow/icons`](/guide/primitives/button#icon) glyph |
| `variant` | `'solid' \| 'soft' \| 'outline' \| 'ghost' \| 'link'`                   | the treatment; defaults to `soft`                             |
| `tone`    | `'neutral' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info'` | the semantic colour; defaults to `neutral`                    |

Place one in a `## view`: `- badge: { label: Done, tone: success, icon: check }`.

In prose, the `:badge[…]` directive sets the **`tone`**: `:badge[Done]{tone=success}`. (`variant=` is accepted as a legacy alias for the same `tone` prop — but prefer `tone=`, since `variant` is now the treatment axis.)

## Styling hooks

The chip carries only a class + the two colour hooks — `tone` sets a `--vow-tone` custom property the `variant` reads, so each combination re-skins with the theme.

| Hook             | Where        | Means                                                                                |
| ---------------- | ------------ | ------------------------------------------------------------------------------------ |
| `.vow-badge`     | the `<span>` | the chip box (`soft` · `neutral` base)                                               |
| `[data-tone]`    | the `<span>` | `neutral` / `accent` / `success` / `warning` / `danger` / `info` (sets `--vow-tone`) |
| `[data-variant]` | the `<span>` | `soft` / `solid` / `outline` / `ghost` / `link`                                      |

## No a11y core — on purpose

Badge is inert text — there's no interaction to prove, so no `@vow/headless` logic and no `*.a11y.test.ts`. It reads as plain text to a screen reader (the colour is decorative). See [primitives](/guide/primitives).
