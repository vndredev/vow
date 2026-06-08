---
group: Fulfilment
order: 0
---

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

→ two files in `.generated/` — a **pure model**, no UI:

- **`task.ts`** — a `Task` interface + a validating `createTask` factory (a missing required field throws). Every entity also gets a stable auto-`id` (the factory generates it) — the identity a `reference` points at.
- **`task.test.ts`** — a Vitest suite **derived from the fields** (a happy path + one reject per required field). No one writes it; the test names _are_ the proven scenarios (see [proof](/guide/proof)).

**Field types:** `text` · `longtext` (multi-line — a `string`, rendered as a `<textarea>`) · `number` · `boolean` · `date` (an ISO-8601 string, rendered as a native date input) · `select(a|b|c)` (a string-literal union, rendered as a `<select>`) · `reference(entity)` (the target entity's id, typed as `string`; in a view it's a **dropdown** of the target's items via the shared store, labelled by the target's first text field). Resolving a referent for display (showing its name in place of the id) is on the [roadmap](/guide/roadmap).

An entity is **data, not a screen** — it never renders by itself. To put it on the page, a view lists it.

## emit view

A view is a page: a **`## view`** block — a YAML list of components (semantic blocks, layout primitives, text). It's the one view path; the full catalog is in [Views](/guide/views). A view that renders an entity's CRUD list references it by slug with `list:`:

```markdown
---
id: vow_home
fulfills: emit view
root: true
---

# Home
```

with the page's components under `## view`:

```yaml
- h2: Your tasks
- list: task
```

→ a `.vue` for the page and — **because the view asked for it** — the entity's CRUD list (`Task.vue`): read · create (inline form) · toggle · delete on local state. Boolean fields become the emitted, accessible [`<Checkbox>`](/guide/primitives). No `list:`, no list — the entity stays a pure model.

## emit form

A form is an entity's create screen. A **`## form`** block bound to an entity with `of:` renders every field as a labelled [`<Field>`](/guide/primitives/field) (a boolean self-labels as a [`<Checkbox>`](/guide/primitives/checkbox)) and validates on submit with the entity's **zod schema** — surfacing a per-field error, never swallowing it:

```markdown
---
id: vow_addtask
fulfills: emit form
---

# Add a task
```

with the form under `## form`:

```yaml
of: task
submit: Add task
```

→ a `.vue` form: each field is wired (`<label for>`, `aria-invalid`, a `role="alert"` error region), a submit [`<Button>`](/guide/primitives/button), and a `submit()` that runs `createTask(draft)`. On a `ZodError` it maps each issue to `errors[field]`, so a missing required field shows its message in place; a valid submit appends to the shared store. The form becomes its **own routed page** at `/<slug>`. (Standalone forms with inline `fields:` are on the [roadmap](/guide/roadmap).)

Next: [bind →](/guide/bind)
