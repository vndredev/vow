# Layout

Layout primitives — `Flex`, and soon `Box` / `Grid` / `Stack` / `Container` — are structural Vue
components for arranging UI. They are the **vocabulary** a view composes. Authoring layout _inside_ a
`.vow.md` (a view's `## tree`) lands in its own step; this page documents the primitives that step
will draw on.

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

More primitives (Box, Grid, Stack, Container) arrive one at a time, each with its own section.
