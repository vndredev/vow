# Getting started

::: warning Foundation phase
vow isn't on npm yet — there's no `npm create vow`, and the `@vow/*` packages are workspace-internal. The way to **experience** vow today is to run the demo app in the repo and watch a vow become a running UI. A standalone install (published packages + a scaffold) is on the [roadmap](/guide/roadmap).
:::

## Run the demo

```bash
git clone https://github.com/vndredev/vow.git
cd vow
vp install          # install the workspace (or: pnpm install)
vp dev apps/demo    # start the dev server
```

Open the printed URL. You see a task list — and you never wrote a `.vue` file. It was generated from a single vow.

## Watch the promise keep itself

The whole demo is one file, `apps/demo/app/task.vow.md`:

```markdown
---
id: vow_task
fulfills: emit entity
kind: entity
---

# Eine Aufgabe, die jemand erledigen muss

## fields

- title: text, required
- done: boolean
- status: select(todo|doing|done)
```

With `vp dev` still running, add a field under `## fields`:

```
- priority: select(low|high)
```

Save. The dev server regenerates `.generated/` and reloads — a `priority` dropdown appears in the create form and a new column in the list. **No `.vue` was touched.** That is the core mechanism: the vow is the truth, the UI is its projection (see [emit](/guide/emit)).

## What just happened

```
app/task.vow.md  →  vow() plugin  →  .generated/{ task.ts · task.test.ts · Task.vue }  →  the app
```

- **`task.ts`** — a `Task` type + a validating `createTask` factory
- **`task.test.ts`** — tests derived from the fields (the [proof](/guide/proof))
- **`Task.vue`** — the default CRUD list, rendered from the [component model](/guide/components)

You can inspect `.generated/`, but never edit it — change the vow, not the output, and it can't drift.

## Verify it like the project does

```bash
vp check        # format · lint · typecheck (tsgo)
pnpm -r test    # tests per package (incl. the scenario-coverage gate)
```

## Where to go next

- [The Vow primitive](/guide/vow) — the one node everything is made of
- [emit](/guide/emit) — what `entity` and `view` generate
- [App structure](/guide/structure) — the three zones: `app/` · `.generated/` · `src/`
