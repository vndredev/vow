# The Vow primitive

Everything is one recursive node — a **Vow**. The same shape describes a single leaf and a whole app, so there's no separate "spec" vocabulary to learn.

A vow lives as a `<slug>.vow.md` file — the filename _is_ the slug. It's plain Markdown:

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

- **frontmatter** — the non-prosaic truth: `id` (immutable, `<prefix>_<suffix>`), `fulfills`, optional `kind`.
- **`#` heading** — the _intent_: the promise, human- and LLM-readable.
- **`## fields`** — the data shape (for `emit entity`).
- **`## proves`** — the scenarios that must hold (for `bind`; for `emit` they're derived).

## Nesting

The folder tree _is_ the vow tree. A `<slug>/` folder beside a `<slug>.vow.md` holds its children:

```
app/
├─ dashboard.vow.md
└─ dashboard/          children of "dashboard"
   ├─ stats.vow.md
   └─ recent.vow.md
```

## Fulfilment

How a vow is kept:

- **`emit`** — generated and verified by the compiler — see [emit](/guide/emit).
- **`bind`** — hand-written, type-checked code — see [bind](/guide/bind).

Status is **never stored** — it's derived from whether the proof is green (see [proof](/guide/proof)).
