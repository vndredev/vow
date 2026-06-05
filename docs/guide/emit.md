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

Next: [bind →](/guide/bind)
