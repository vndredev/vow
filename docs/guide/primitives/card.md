---
group: UI
order: 3.6
---

# Card

A bordered content surface for one record or one panel. `Card` is **structural** — no headless core, just class hooks — and **composable parts** (like the [Table](/guide/primitives/table)): a `Card` wraps a `CardHeader` (a title row + optional actions) and a `CardBody` (the content).

| Part         | Renders | Hook                |
| ------------ | ------- | ------------------- |
| `Card`       | `<div>` | `.vow-card`         |
| `CardHeader` | `<div>` | `.vow-card__header` |
| `CardBody`   | `<div>` | `.vow-card__body`   |

```vue
<Card>
  <CardHeader>
    Fix the login flow
    <Badge variant="warning" label="blocked" />
  </CardHeader>
  <CardBody> A user can't sign in after the redirect. </CardBody>
</Card>
```

The parts are optional — a `Card` with just a default slot is a plain bordered panel. The `cards` view pattern (on the [roadmap](/guide/roadmap)) composes these per record; like the entity list, that is a **composition**, not a primitive.
