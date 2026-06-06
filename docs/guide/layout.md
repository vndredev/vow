# Layout

Layout primitives — `Flex`, `Grid`, `Box`, `Container` — are structural Vue components for arranging
UI. They are the **vocabulary** a view composes. Authoring layout _inside_ a `.vow.md` (a view's
`## tree`) lands in its own step; this page documents the primitives that step will draw on.

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
