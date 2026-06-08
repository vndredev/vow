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

Open the printed URL. You see the vow starter — a left sidebar (the [app shell](/guide/shell)), a home of three [cards](/guide/primitives/card), and an **Add a task** page with a labelled, validated form — and you never wrote a `.vue` file. It's all from vows: the home is a [`## view`](/guide/views), the form an [`emit form`](/guide/emit) over the `task` entity, and the sidebar nav is built from the pages.

## Watch the promise keep itself

The form is generated from the `task` entity, one file — `apps/starter/app/task.vow.md`:

```markdown
---
id: vow_task
fulfills: emit entity
---

# A task someone must do

## fields

- title: text, required
- status: select(todo|doing|done)
- notes: longtext
- done: boolean
```

With `vp dev` still running, add a field under `## fields`:

```
- priority: select(low|high)
```

Save. The dev server regenerates `.generated/` and reloads — a `priority` dropdown appears in the **Add a task** form, validated by the entity's zod schema. **No `.vue` was touched.** That is the core mechanism: the vow is the truth, the UI is its projection (see [emit](/guide/emit)).

## What just happened

```
app/task.vow.md      →  vow() plugin  →  .generated/{ task.ts · task.test.ts }
app/add-task.vow.md  →  vow() plugin  →  .generated/{ add-task.vue · Field/Select/Button adapters }
app/home.vow.md      →  vow() plugin  →  .generated/{ home.vue · the Card parts · main.ts · … }
```

- **`task.ts`** — a `Task` type + a validating `createTask` factory
- **`task.test.ts`** — tests derived from the fields (the [proof](/guide/proof))
- **`add-task.vue`** — the form: labelled `<Field>`s + zod validation, from the [component model](/guide/components)

The entity is a **pure model** — it never renders by itself; the form puts it to work (`of: task`). Change a field, and the model, its test, and the form all follow.

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
