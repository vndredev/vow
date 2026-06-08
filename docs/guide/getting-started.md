---
group: Introduction
order: 1
---

# Getting started

::: warning Foundation phase
vow isn't on npm yet — there's no `npm create vow`, and the `@vow/*` packages are workspace-internal. The way to **experience** vow today is to run the starter app in the repo and watch vows become a running UI. A standalone install (published packages + a `vow create` scaffold) is on the [roadmap](/guide/roadmap).
:::

## Run the starter

```bash
git clone https://github.com/vndredev/vow.git
cd vow
```

Then install + run — pick your package manager:

::: code-group

```bash [pnpm]
vp install
vp dev apps/starter
```

```bash [npm]
npm install
npx vp dev apps/starter
```

```bash [yarn]
yarn
yarn vp dev apps/starter
```

:::

Open the printed URL. You see a dashboard — a left sidebar nav, and a home page with a hero, a "Tasks" heading, a link to the add-task page, then a generated task list — and you never wrote a `.vue` file. It's all from vows: the home page is a [`## view`](/guide/views), and its `list: task` pulls in the task entity's CRUD list. The sidebar is the [app shell](/guide/shell), wrapping every page.

## Watch the promise keep itself

The task list is generated from one file, `apps/starter/app/task.vow.md`:

```markdown
---
id: vow_task
fulfills: emit entity
---

# A task someone must do

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
app/task.vow.md      →  vow() plugin  →  .generated/{ task.ts · task.test.ts }
app/home.vow.md      →  vow() plugin  →  .generated/{ home.vue · Task.vue · main.ts · … }
```

- **`task.ts`** — a `Task` type + a validating `createTask` factory
- **`task.test.ts`** — tests derived from the fields (the [proof](/guide/proof))
- **`Task.vue`** — the CRUD list, rendered from the [component model](/guide/components)

The entity is a **pure model** — it never renders by itself. `Task.vue` exists only because the home page's `## view` says `list: task`, which pulls the list in. Change the field, and the model, its test, and the list all follow.

You can inspect `.generated/`, but never edit it — change the vow, not the output, and it can't drift.

## Verify it like the project does

```bash
vp check        # format · lint · typecheck (tsgo)
pnpm -r test    # tests per package (incl. the scenario-coverage gate)
```

## Where to go next

- [The Vow primitive](/guide/vow) — the one node everything is made of
- [emit](/guide/emit) — what `entity`, `view` and `form` generate
- [App structure](/guide/structure) — the two zones: `app/` (hand-written) · `.generated/` (generated)
