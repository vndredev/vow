---
group: UI
order: 3.0
---

# Button

The one **structural** control with **no headless core**. A native `<button>` is already accessible — it has the role, the keyboard, the focus — so there is no behaviour to prove in `@vow/headless` and nothing to re-implement. Button exists for one reason the bare element can't give you consistently: the **design-language surface** the theme can dress. It is `<button>` + a `class` + the four-axis `data-*` hooks — **variant · tone · size · density** — and nothing more.

## See it run

The buttons below are the **exact** generated adapter — `emitButtonSfc()` written to a real `.vue` file at build time and dressed in vow's base look (`@vow/theme`):

::: demo button
:::

## The four axes

A button's look is **four orthogonal axes** — vow's [design language](/guide/design):

- **`variant`** — the treatment: `solid` (fill) · `soft` (tint) · `outline` (border) · `ghost` (bare) · `link` (text).
- **`tone`** — the semantic colour: `neutral` · `accent` · `success` · `warning` · `danger` · `info`. `variant` reads `tone` through a single `--vow-tone` custom property, so the two compose freely.
- **`size`** — the control scale: `xs` · `sm` · `md` · `lg` · `xl`.
- **`density`** — the vertical spacing: `comfortable` (default) or `compact`.

vow never concatenates variant classes at runtime — it spreads typed prop objects, so each axis is just a **`data-*` hook**, exactly like a primitive's `data-state`. You pick the look with typed props; the theme maps them to tokens.

```md
## view

- button: { label: Save }
- button: { label: Cancel, variant: outline }
- button: { label: Delete, variant: ghost, tone: danger, size: sm }
```

Because the axes live on `data-variant` / `data-tone` / `data-size` / `data-density` — separate attributes from any `data-state` — they compose for free: `[data-variant="outline"][data-disabled]` is a valid, conflict-free selector with no merge function.

## Props

Derived from the adapter's `Component` definition:

| Prop      | Type                                                                    | Purpose                                         |
| --------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| `label`   | `string` (optional)                                                     | the button text — the default slot's fallback   |
| `icon`    | `IconName` (optional)                                                   | a leading [`@vow/icons`](#icon) glyph           |
| `variant` | `'solid' \| 'soft' \| 'outline' \| 'ghost' \| 'link'`                   | the treatment; defaults to `solid`              |
| `tone`    | `'neutral' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info'` | the semantic colour; defaults to `accent`       |
| `size`    | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'`                                  | the scale; defaults to `md`                     |
| `density` | `'comfortable' \| 'compact'`                                            | the vertical spacing; defaults to `comfortable` |
| `type`    | `'button' \| 'submit'`                                                  | the native button type; defaults to `button`    |

The content is a default `<slot>` that falls back to `label`, so both `- button: { label: Save }` and a slotted `<Button>…</Button>` work.

## Icon

A button takes an optional **`icon`** — a glyph from [`@vow/icons`](/guide/architecture) (the swappable icon layer), rendered before the label: `- button: { label: Add task, icon: plus }`. The same `icon` is available on a [`link:`](/guide/views) node. Icons size with the surrounding font (`1em`) and inherit `currentColor`, so a button's icon takes its tone's text colour for free. The full set (`IconName`, named by meaning): :icon[arrow-right] `arrow-right` · :icon[check] `check` · :icon[chevron-down] `chevron-down` · :icon[chevron-right] `chevron-right` · :icon[close] `close` · :icon[git-commit] `git-commit` · :icon[home] `home` · :icon[layers] `layers` · :icon[list-checks] `list-checks` · :icon[menu] `menu` · :icon[monitor] `monitor` · :icon[moon] `moon` · :icon[pencil] `pencil` · :icon[plus] `plus` · :icon[search] `search` · :icon[settings] `settings` · :icon[sun] `sun` · :icon[trash] `trash` · :icon[users] `users`. _(For accessibility, give an icon-only button a `label` — it's the accessible name.)_

## Styling hooks

The adapter carries only a class and the four-axis hooks — never a color or size literal. vow's base look (`@vow/theme`) targets them, and swapping the theme re-skins every button without the adapter changing.

| Hook             | Where          | Means                                                                                |
| ---------------- | -------------- | ------------------------------------------------------------------------------------ |
| `.vow-button`    | the `<button>` | the base box (padding, radius, font; `md` · `comfortable`)                           |
| `[data-variant]` | the `<button>` | `solid` / `soft` / `outline` / `ghost` / `link`                                      |
| `[data-tone]`    | the `<button>` | `neutral` / `accent` / `success` / `warning` / `danger` / `info` (sets `--vow-tone`) |
| `[data-size]`    | the `<button>` | `xs` / `sm` / `md` / `lg` / `xl`                                                     |
| `[data-density]` | the `<button>` | `comfortable` / `compact`                                                            |

## No a11y core — on purpose

There is no `*.a11y.test.ts` for Button, because there is no headless logic to prove: it is a real `<button>`, accessible by construction. This is the deliberate exception to vow's "only build what HTML can't" rule — every _other_ primitive earns a headless core because HTML can't style or make-accessible the native element; Button earns a component only for the variant/theme surface. See [primitives](/guide/primitives).
