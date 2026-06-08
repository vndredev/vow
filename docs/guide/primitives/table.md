---
group: UI
order: 3.5
---

# Table

A `<table>` is native and accessible, so `Table` is a **structural** primitive — no headless core, just class hooks. And it's **composable parts** you assemble (like shadcn / Reka tables), not a data-driven black box — so any composition (an entity list, a board, a stats view) builds exactly the table it needs.

| Part        | Renders   | Hook               |
| ----------- | --------- | ------------------ |
| `Table`     | `<table>` | `.vow-table`       |
| `TableRow`  | `<tr>`    | `.vow-table__row`  |
| `TableHead` | `<th>`    | `.vow-table__head` |
| `TableCell` | `<td>`    | `.vow-table__cell` |

```vue
<Table>
  <thead>
    <TableRow>
      <TableHead scope="col">Title</TableHead>
      <TableHead scope="col">Done</TableHead>
    </TableRow>
  </thead>
  <tbody>
    <TableRow v-for="t in tasks" :key="t.id">
      <TableCell>{{ t.title }}</TableCell>
      <TableCell><Checkbox v-model="t.done" label="done" /></TableCell>
    </TableRow>
  </tbody>
</Table>
```

`scope`, `class` and `aria-*` fall through to the native element, so cells stay hookable (`<TableCell class="field-title">`). Wrapping native elements buys nothing semantically — the win is the **shared class hooks the theme styles once**, so every table in vow looks the same and re-skins together.

## Primitive vs composition

The **entity list** (`list: <entity>`) is the first composition over these parts — a real, themed table you see live in any generated app. It's a **composition**, not a primitive: it knows your entity's fields and binds the store. `Table` doesn't know your data; that's the line. See [Architecture](/guide/architecture).
