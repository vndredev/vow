---
group: UI
order: 3.8
---

# Card

A bordered content surface for one record or one panel. `Card` is **structural** — no headless core, just class hooks — and **composable parts** (like the [Table](/guide/primitives/table)): a `Card` wraps a `CardHeader` (a title row + optional actions) and a `CardBody` (the content).

## See it run

::: demo card
:::

## Parts

| Part         | Renders | Hook                |
| ------------ | ------- | ------------------- |
| `Card`       | `<div>` | `.vow-card`         |
| `CardHeader` | `<div>` | `.vow-card__header` |
| `CardBody`   | `<div>` | `.vow-card__body`   |

The parts are optional — a `Card` with just a default slot is a plain bordered panel.

## Styling hooks

| Hook                | Where          | Means                         |
| ------------------- | -------------- | ----------------------------- |
| `.vow-card`         | the `<div>`    | the bordered surface          |
| `.vow-card__header` | the header div | the title row (a bottom rule) |
| `.vow-card__body`   | the body div   | the padded content            |

## No a11y core — on purpose

Card is structural — a styled `<div>`, no `@vow/headless` logic. The `cards` view pattern (on the [roadmap](/guide/roadmap)) composes these per record; like the entity list, that is a **composition**, not a primitive. See [Architecture](/guide/architecture).
