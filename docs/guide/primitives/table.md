---
group: UI
order: 3.7
---

# Table

A `<table>` is native and accessible, so `Table` is a **structural** primitive — no headless core, just class hooks. And it's **composable parts** (like shadcn / Reka tables), not a data-driven black box: assemble the table any composition needs.

## See it run

::: demo table
:::

## Parts

| Part        | Renders   | Hook               |
| ----------- | --------- | ------------------ |
| `Table`     | `<table>` | `.vow-table`       |
| `TableRow`  | `<tr>`    | `.vow-table__row`  |
| `TableHead` | `<th>`    | `.vow-table__head` |
| `TableCell` | `<td>`    | `.vow-table__cell` |

`scope`, `class` and `aria-*` fall through to the native element, so each cell stays hookable (`<TableCell class="field-title">`).

## Styling hooks

| Hook               | Where         | Means                               |
| ------------------ | ------------- | ----------------------------------- |
| `.vow-table`       | the `<table>` | the bordered card                   |
| `.vow-table__head` | each `<th>`   | a header cell                       |
| `.vow-table__cell` | each `<td>`   | a body cell                         |
| `.vow-table__row`  | each `<tr>`   | a row (hover + hairline in `tbody`) |

## No a11y core — on purpose

The native `<table>` / `<th scope>` / `<td>` semantics _are_ the accessibility — there's no interaction to prove, so no `@vow/headless` logic. The **entity list** (`list: <entity>`) is the first composition over these parts: a real table that knows your entity's fields. `Table` doesn't — that's the line between a [primitive and a composition](/guide/architecture).
