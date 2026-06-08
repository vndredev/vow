---
group: UI
order: 3.9
---

# Stats

A row of **metric tiles** — a KPI strip. `Stats` is **structural** (no headless core), composable parts: a `Stats` container lays its `Stat` tiles out in a responsive grid; each `Stat` is a value over a label.

## See it run

::: demo stats
:::

## Props

`Stats` takes no props — it's the responsive container; put `<Stat>`s in its slot. Each `Stat`:

| Prop    | Type               | Purpose                       |
| ------- | ------------------ | ----------------------------- |
| `value` | `string \| number` | the metric, shown large       |
| `label` | `string`           | the caption beneath the value |

## Styling hooks

| Hook               | Where          | Means                    |
| ------------------ | -------------- | ------------------------ |
| `.vow-stats`       | the container  | the responsive tile grid |
| `.vow-stat`        | each tile      | the bordered tile        |
| `.vow-stat__value` | the value span | the large number         |
| `.vow-stat__label` | the label span | the muted caption        |

## No a11y core — on purpose

Stats is structural — styled `<div>`s, no `@vow/headless` logic. A `stats` view (on the [roadmap](/guide/roadmap)) computes the values from an entity's records; that's a **composition** over these tiles. See [Architecture](/guide/architecture).
