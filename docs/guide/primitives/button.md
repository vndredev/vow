---
group: UI
order: 3.0
---

# Button

The one **structural** control with **no headless core**. A native `<button>` is already accessible — it has the role, the keyboard, the focus — so there is no behaviour to prove in `@vow/headless` and nothing to re-implement. Button exists for one reason the bare element can't give you consistently: a **variant and size surface** the theme can dress. It is `<button>` + a `class` + two `data-*` hooks, and nothing more.

## See it run

The buttons below are the **exact** generated adapter — `emitButtonSfc()` written to a real `.vue` file at build time and dressed in vow's base look (`@vow/theme`):

::: demo button
:::

## Variants, the vow way

shadcn/ui reaches for `cva` + `tailwind-merge` to compose variant classes at runtime. vow never concatenates class strings — it spreads typed prop objects — so a variant is just another **`data-*` hook**, exactly like a primitive's `data-state`. You pick the look with a typed prop; the theme maps it to tokens.

```md
## view

- button: { label: Save, variant: default }
- button: { label: Cancel, variant: outline }
- button: { label: Dismiss, variant: ghost, size: sm }
```

Because variants live on `data-variant` / `data-size` — separate attributes from any `data-state` — they compose for free: `[data-variant="outline"][data-disabled]` is a valid, conflict-free selector with no merge function.

## Props

Derived from the adapter's `Component` definition:

| Prop      | Type                                | Purpose                                       |
| --------- | ----------------------------------- | --------------------------------------------- |
| `label`   | `string` (optional)                 | the button text — the default slot's fallback |
| `icon`    | `IconName` (optional)               | a leading [`@vow/icons`](#icon) glyph         |
| `variant` | `'default' \| 'outline' \| 'ghost'` | the look; defaults to `default`               |
| `size`    | `'sm' \| 'md' \| 'lg'`              | the scale; defaults to `md`                   |
| `type`    | `'button' \| 'submit'`              | the native button type; defaults to `button`  |

The content is a default `<slot>` that falls back to `label`, so both `- button: { label: Save }` and a slotted `<Button>…</Button>` work.

## Icon

A button takes an optional **`icon`** — a glyph from [`@vow/icons`](/guide/architecture) (the swappable icon layer), rendered before the label: `- button: { label: Add task, icon: plus }`. The same `icon` is available on a [`link:`](/guide/views) node. Icons size with the surrounding font (`1em`) and inherit `currentColor`, so a button's icon takes its variant's text colour for free. Available names: :icon[plus] `plus` · :icon[trash] `trash` · :icon[pencil] `pencil` · :icon[arrow-right] `arrow-right` · :icon[check] `check` · :icon[x] `x` · :icon[search] `search` · :icon[menu] `menu` · :icon[chevron-down] `chevron-down` · :icon[chevron-right] `chevron-right` · :icon[sun] `sun` · :icon[moon] `moon` · :icon[monitor] `monitor`. _(For accessibility, give an icon-only button a `label` — it's the accessible name.)_

## Styling hooks

The adapter carries only a class and the two variant hooks — never a color or size literal. vow's base look (`@vow/theme`) targets them, and swapping the theme re-skins every button without the adapter changing.

| Hook             | Where          | Means                                |
| ---------------- | -------------- | ------------------------------------ |
| `.vow-button`    | the `<button>` | the base box (padding, radius, font) |
| `[data-variant]` | the `<button>` | `default` / `outline` / `ghost`      |
| `[data-size]`    | the `<button>` | `sm` / `md` / `lg`                   |

## No a11y core — on purpose

There is no `*.a11y.test.ts` for Button, because there is no headless logic to prove: it is a real `<button>`, accessible by construction. This is the deliberate exception to vow's "only build what HTML can't" rule — every _other_ primitive earns a headless core because HTML can't style or make-accessible the native element; Button earns a component only for the variant/theme surface. See [primitives](/guide/primitives).
