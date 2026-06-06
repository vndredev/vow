# emit — generated

An `emit` vow is generated deterministically into `.generated/` and verified by the compiler. You declare; vow produces.

## emit vue

```markdown
---
id: vow_card
fulfills: emit vue
---

# Welcome to vow
```

→ a real `.vue` SFC in `.generated/`, compiled by `@vitejs/plugin-vue`. Editing the `.vow.md` regenerates the `.vue` and reloads the page live (HMR).

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

→ two files in `.generated/`:

- **`task.ts`** — a `Task` interface and a validating `createTask` factory (missing required field → throws).
- **`task.test.ts`** — a Vitest suite **derived from the fields** (a happy path + one reject per required field).

The proof falls out of the declaration — no one writes that test. The test names _are_ the proven scenarios (see [proof](/guide/proof)).

## emit view

A view renders a list of an entity. It points at the entity with `of:`:

```markdown
---
id: vow_tasks
fulfills: emit view
of: task
---

# Aufgaben verwalten
```

→ a typed `.vue` in `.generated/`: it imports the entity's `Task` type, takes an `items: Task[]` prop into local state, and renders one row per item. **Text fields render as-is; boolean fields become the emitted, accessible `<Checkbox>`** — so the row is interactive. The checkbox adapter is generated alongside (`@vow/emit-primitive`) over the `@vow/headless` core, whose accessibility is proven framework-free (see [primitives](/guide/primitives)). Create / delete grow from here.

Next: [bind →](/guide/bind)
