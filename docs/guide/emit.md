# emit — generated

An `emit` vow is generated deterministically into `.generated/` and verified by the compiler. You declare; vow produces. There are two `emit` targets today: **entity** and **view**.

## emit entity

```markdown
---
id: vow_task
fulfills: emit entity
---

# A task someone must do

## fields

- title: text, required
- done: boolean
```

→ three files in `.generated/`:

- **`task.ts`** — a `Task` interface + a validating `createTask` factory (a missing required field throws).
- **`task.test.ts`** — a Vitest suite **derived from the fields** (a happy path + one reject per required field). No one writes it; the test names _are_ the proven scenarios (see [proof](/guide/proof)).
- **`Task.vue`** — a **default CRUD list** over the entity: read · create (inline form) · toggle · delete, on local component state. Boolean fields become the emitted, accessible [`<Checkbox>`](/guide/primitives).

**Field types:** `text` · `number` · `boolean` · `select(a|b|c)` (a string-literal union, rendered as a `<select>`). More (date · reference) + relations are on the [roadmap](/guide/roadmap).

One entity vow gives you the model **and** its UI — no separate view file for the common case.

## emit view

Need a _second_ or _different_ view of an entity — a board, a detail page? Add a view vow that points at the entity with `of:`:

```markdown
---
id: vow_board
fulfills: emit view
of: task
---

# Board
```

→ another typed `.vue` over the same entity. For the common case (one entity, one list) you don't need this — the entity already brings its default view.

Next: [bind →](/guide/bind)
