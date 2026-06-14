---
group: Fulfilment
order: 0
---

# emit — generated

An `emit` vow is generated deterministically into `.generated/` and verified by the compiler. You declare; vow produces. There are three `emit` targets: **entity**, **view**, and **form**.

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

- **`task.ts`** — a `Task` type (`export type Task = z.infer<typeof TaskSchema>`, inferred from the entity's zod schema) + a validating `createTask` factory (a missing required field throws). Every entity also gets a stable auto-`id` (the factory generates it) — the identity a `reference` points at.
- **`task.test.ts`** — a Vitest suite **derived from the fields** (a happy path + one reject per required field). No one writes it; the test names _are_ the proven scenarios (see [proof](/guide/proof)).

**Field types:** `text` · `longtext` (multi-line — a `string`, rendered as a `<textarea>`) · `number` · `boolean` · `date` (an ISO-8601 string, rendered as a native date input) · `select(a|b|c)` (a string-literal union, rendered through vow's [`<Select>`](/guide/primitives) primitive over the fixed options — not a native `<select>`) · `reference(entity)` (the target entity's id, typed as `string`; in a form it's the same [`<Select>`](/guide/primitives) primitive over the target's items via the shared store, labelled by the target's first text field). For display, a reference resolves to its target's **name** — its first text field — shown in place of the id (see [emit view](#emit-view)).

An entity is **data, not a screen** — it never renders by itself. To put it on the page, a view lists it.

**Seed data.** An entity may carry a **`## seed`** — a YAML list of sample records. Each is built through the factory (validated + auto-`id`'d) into a `<slug>Seed` array, and the generated boot loads it into the store once on start (idempotent, so a reload never duplicates) — so the list, cards, board and stats open with real data instead of empty.

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

→ a `.vue` for the page and — **because the view asked for it** — the entity's **read-only table** (`Task.vue`): a real `<table>` with a header from the field names and a row per record (a select value as a [`<Badge>`](/guide/primitives), a reference resolved to its target's **name**, a boolean as Yes/No). The list only _displays_ — the studio is read-only; the agent mutates the data via the MCP. No `list:`, no table — the entity stays a pure model.

Every store-backed view (list, cards, board, stats, and the issue layouts) carries the same **loading / failed / empty** status trio, and each status node is a **live region** so a screen reader hears the async swap (WCAG 4.1.3 Status Messages). Loading and the genuinely-empty copy are polite (`role="status"` + `aria-live="polite"`); a **failed fetch** is assertive (`role="alert"` + `aria-live="assertive"`), so the error is announced at once rather than leaving a screen-reader user on a silently-empty view.

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

→ a `.vue` form: each field is wired (`<label for>`, `aria-invalid`, a `role="alert"` error region), a submit [`<Button>`](/guide/primitives/button), and a `submit()` that runs `createTask(draft)`. On a `ZodError` it maps each issue to `errors[field]`, so a missing required field shows its message in place; a valid submit appends to the shared store. The form becomes its **own routed page** at `/<slug>`. (A form binds to an entity with `of:`; standalone forms with an inline `fields:` list are **not yet supported**.)

The error association is the same for **every** control: each field's error region is keyed `<field>Id-error`, and the control points its `aria-describedby` at it (with `aria-invalid` when the field errors). A boolean's [`<Checkbox>`](/guide/primitives/checkbox) is no exception — it forwards `described-by` + `invalid` onto its control, so a screen reader navigating to the checkbox finds the error text and the invalid state durably, not just the once-announced `role="alert"`.

### Edit a singleton (`edit: true`)

For an entity that holds **one row** (a settings/config record), add `edit: true` to the `## form`:

```yaml
of: config
submit: Save settings
edit: true
```

The form turns into a **singleton editor**: it pre-loads the entity's current row into `draft` (a `watch` refills it when the row loads), and `submit()` **`update`s that row in place** — keeping its id — instead of appending a duplicate. The fields stay filled after saving, and a transient `role="status"` "Saved" confirmation appears. A create form (no `edit:`) stays append-and-clear.

Next: [bind →](/guide/bind)
