# Layout

Layout primitives — `Flex`, `Grid`, `Box`, `Container` — are structural Vue components for arranging
UI. They are the **vocabulary**; a view's [`## tree`](#the-tree) composes them. Layout is authored
_inside_ the `.vow.md`, so the spec stays the single source of truth — no hand-edited component the
spec can't reach.

## The `## tree`

A view can carry a `## tree` section: an indented list where each `- Name(prop=value)` is a layout
primitive (or `slot`), and indentation is nesting. The generator turns it into a Vue SFC — a view
**with** a tree needs no `of:` entity (its tree _is_ the component); **without** one it stays the
default entity list.

```markdown
---
id: vow_shell
fulfills: emit view
---

# The app shell

## tree

- Container(size=2)
  - Flex(direction=column, gap=5)
    - slot(name=header)
    - slot
```

A numeric prop is passed as a number (`gap=4` → `:gap="4"`), anything else as a string
(`direction=column` → `:direction="'column'"`); `slot` becomes a `<slot>` outlet (`slot(name=x)` a
named one). The referenced primitives are emitted alongside the view, so their imports resolve.

## Not primitives in the accessibility sense

A `<div style="display: flex">` is something the browser does natively, so — unlike a
[primitive](/guide/primitives) such as the checkbox — layout components carry **no** ARIA, no keyboard
logic, no `@vow/headless` core. They are pure structure: a [`Component`](/guide/components) whose
`view` is a styled element with a `<slot>`, rendered by `renderVueSfc`. Because they ride the same
model, a future React/Solid adapter renders them too — no rewrite.

## Flex

A flex container. Props mirror the CSS with ergonomic enum values (Radix-style):

| Prop        | Values                                              | CSS               |
| ----------- | --------------------------------------------------- | ----------------- |
| `direction` | `row` · `column` · `row-reverse` · `column-reverse` | `flex-direction`  |
| `align`     | `start` · `center` · `end` · `baseline` · `stretch` | `align-items`     |
| `justify`   | `start` · `center` · `end` · `between`              | `justify-content` |
| `wrap`      | `nowrap` · `wrap` · `wrap-reverse`                  | `flex-wrap`       |
| `gap`       | a number — a step on the spacing scale              | `gap`             |

`start` / `end` / `between` translate to `flex-start` / `flex-end` / `space-between`; `gap` resolves
to a `@vow/theme` spacing token (`--vow-space-<n>`), undefined until the theme defines the scale —
harmless, the component runs bare and the design system layers on. Defaults: `direction=row`,
`align=stretch`, `justify=start`, `wrap=nowrap`, `gap=0`.

## Grid

A grid container. `align` / `justify` / `gap` work as in `Flex`; `columns` is either a count (equal
`minmax(0, 1fr)` tracks) or a raw `grid-template-columns` string.

| Prop      | Values                                              | CSS                     |
| --------- | --------------------------------------------------- | ----------------------- |
| `columns` | a number (equal tracks) or a template string        | `grid-template-columns` |
| `align`   | `start` · `center` · `end` · `baseline` · `stretch` | `align-items`           |
| `justify` | `start` · `center` · `end` · `between`              | `justify-content`       |
| `gap`     | a number — a step on the spacing scale              | `gap`                   |

Defaults: `columns=1`, `align=stretch`, `justify=start`, `gap=0`.

## Box

A generic box. `p` is padding from the spacing scale; `width` / `height` pass through verbatim.

| Prop     | Values                                 | CSS       |
| -------- | -------------------------------------- | --------- |
| `p`      | a number — a step on the spacing scale | `padding` |
| `width`  | any CSS length                         | `width`   |
| `height` | any CSS length                         | `height`  |

Defaults: `p=0`; `width` / `height` are unset unless given.

## Container

A centered content frame. `size` selects a max-width step (`--vow-container-<size>`) and centers the
content with auto horizontal margins.

| Prop   | Values                | CSS                       |
| ------ | --------------------- | ------------------------- |
| `size` | `1` · `2` · `3` · `4` | `max-width` (+ centering) |

Default: `size=3`. Stack-style vertical layout is just `Flex` with `direction=column`, so there is no
separate Stack primitive.

## Spacing & sizing tokens

The numeric props don't take raw lengths — they index a scale defined in `@vow/theme` (`vow.css`),
so the whole UI re-spaces from one place. A `gap`/`p` of `n` resolves to `var(--vow-space-<n>)`; a
Container `size` of `n` resolves to `var(--vow-container-<n>)`.

| Token               | Value     | Token               | Value    |
| ------------------- | --------- | ------------------- | -------- |
| `--vow-space-0`     | `0`       | `--vow-space-5`     | `1.5rem` |
| `--vow-space-1`     | `0.25rem` | `--vow-space-6`     | `2rem`   |
| `--vow-space-2`     | `0.5rem`  | `--vow-space-7`     | `2.5rem` |
| `--vow-space-3`     | `0.75rem` | `--vow-space-8`     | `3rem`   |
| `--vow-space-4`     | `1rem`    | `--vow-space-9`     | `4rem`   |
| `--vow-container-1` | `28rem`   | `--vow-container-3` | `55rem`  |
| `--vow-container-2` | `43rem`   | `--vow-container-4` | `71rem`  |

The tokens are undefined only if you drop `@vow/theme` — then the primitives fall back to no gap /
no max-width (bare), and your own stylesheet supplies the scale.
