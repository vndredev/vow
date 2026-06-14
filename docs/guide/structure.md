---
group: Introduction
order: 3
---

# App structure

A vow app lives in **two zones**: you work in `app/`, and vow writes everything else into `.generated/` — including the boot. There is no hand-written `src/` shell. (This page is _your app's_ layout; for how vow turns it into running code — the pipeline and packages — see [Architecture](/guide/architecture).)

## The folder layout

```
my-app/
├─ app/                     YOUR TRUTH — the app as vows (visible, versioned)
│  ├─ home.vow.md           view → a ## view (root: true), lists task — the entry page
│  ├─ task.vow.md           entity → a model (zod schema + factory + tests); no UI by itself
│  ├─ user.vow.md           entity → referenced by task.assignee
│  ├─ add-task.vow.md       form → a ## form bound to task (validated, per-field errors)
│  ├─ users.vow.md          view → its own page (a route at /users)
│  ├─ task-summary.vow.md   bind → fulfills: bind ./task-summary.ts#summarise
│  ├─ task-summary.ts       the 10% — hand-written code, right beside its vow
│  └─ task-summary.test.ts  its proof (the test names ARE the vow's ## proves)
├─ .generated/             MACHINE OUTPUT (hidden · gitignored · never edited)
│  ├─ task.ts  task.test.ts the entity (a zod schema + type + factory) + its derived tests
│  ├─ Task.vue              its CRUD list — emitted because home says `list: task`
│  ├─ Checkbox.vue Field.vue  emitted primitive adapters (over @vow/headless)
│  ├─ home.vue users.vue    the pages + Flex/Grid/Box/Stack/Container primitives
│  ├─ home.render.test.ts   each view/form's proof — mounts the .vue + runs axe (render + a11y)
│  ├─ add-task.vue          the form — labelled <Field>s + zod validation
│  ├─ add-task.form.test.ts the form's proof — submits empty, asserts a role="alert" surfaces
│  ├─ vow-pages.routes.ts   the route table for non-root pages (/add-task, /users)
│  ├─ vow-app.layout.vue    the app chrome (wraps every page in @vow/shell)
│  ├─ main.ts               the boot — mounts the root page (was a hand-written src/)
│  ├─ vow-env.d.ts          *.vue / *.css shims for tsgo
│  └─ task-summary.bind.ts  bind anchor (tsgo verifies the seam)
├─ index.html               loads /.generated/main.ts
├─ vite.config.ts           plugins: [vue(), vow()]  (the app title is the root vow's `title:`)
├─ tsconfig.json            include: ["app", ".generated"]
└─ package.json             @vow/headless · @vow/store · @vow/router · @vow/shell · @vow/theme · vue · zod
```

_A fuller example — it shows every vow type. The minimal [starter](/guide/getting-started) you run is just `home` + `task` + `add-task` (a view, an entity, a form); the [studio](/guide/changelog) adds the references, lists and stats._

The 10 % of hand-written code lives **co-located** — `task-summary.ts` sits right next to the
`task-summary.vow.md` that binds it, not in a separate `lib/`. The unit is "a feature = its vow + its
own code". There is no `components/` or `views/` folder by design: those are generated, never written.

## The two zones

| Zone          | Who writes it                                             | In git?             |
| ------------- | --------------------------------------------------------- | ------------------- |
| `app/`        | you (or the LLM) — vows + the 10 % bind code              | **yes — the truth** |
| `.generated/` | vow — `.ts` / `.vue` / `.test.ts` / `.bind.ts` / the boot | no — regenerated    |

You see only `app/` in the editor — not a codebase. Even the boot (`main.ts`) is generated from the `root: true` page, so there is nothing to hand-wire. `.generated/` is inspectable but never the source, and can't drift.

## The vow types

```
fulfills: emit entity   → a model: a zod schema + type + factory + derived tests (no UI by itself)
fulfills: emit view     → a page from a ## view; its `list:` pulls in entity lists
fulfills: emit form     → a ## form bound to an entity (of:) — labelled fields, validated on submit
fulfills: bind …#export → points at hand-written code, verified by tsgo
```

An `entity` vow yields **only the model** — it never renders by itself. A view puts it on the page by listing it (`list: task`), which emits its CRUD list (`Task.vue`). One rule: views render, entities are data. Every non-root view and every form becomes a **routed page** (`/<slug>`), wrapped in the `@vow/shell` chrome.

::: warning Roadmap
The entry page (`root: true`), multi-page **routing** (non-root views + forms → `/<slug>`), and the **data adapter** (`@vow/store`) all exist — now backed by **local SQLite** (`@vow/db`, `node:sqlite`), so records persist across reloads in `.vow/data.db`. Still to come: auth and Cloudflare D1 (prod) behind the same `useCollection` seam.
:::
