---
group: Introduction
order: 3
---

# App structure

A vow app lives in **two zones**: you work in `app/`, and vow writes everything else into `.generated/` — including the boot. There is no hand-written `src/` shell.

## The folder layout

```
my-app/
├─ app/                     YOUR TRUTH — the app as vows (visible, versioned)
│  ├─ landing.vow.md        view → a ## view (root: true), lists task — the entry page
│  ├─ task.vow.md           entity → a model (type + factory + tests); no UI by itself
│  ├─ invoice-total.vow.md  bind   → fulfills: bind ./invoice-total.ts#computeTotal
│  ├─ invoice-total.ts      the 10% — hand-written code, right beside its vow
│  └─ invoice-total.test.ts its proof (the test names ARE the vow's ## proves)
├─ .generated/             MACHINE OUTPUT (hidden · gitignored · never edited)
│  ├─ task.ts  task.test.ts the entity model + its derived tests
│  ├─ Task.vue              its CRUD list — emitted because landing says `list: task`
│  ├─ Checkbox.vue          emitted primitive adapters (over @vow/headless)
│  ├─ landing.vue           the page + Flex/Grid/Box/Container primitives
│  ├─ main.ts               the boot — mounts the root page (was a hand-written src/)
│  ├─ vow-env.d.ts          *.vue / *.css shims for tsgo
│  └─ invoice-total.bind.ts bind anchor (tsgo verifies the seam)
├─ index.html               loads /.generated/main.ts
├─ vite.config.ts           plugins: [vue(), vow()]
├─ tsconfig.json            include: ["app", ".generated"]
└─ package.json             @vow/headless · @vow/theme · vue
```

The 10 % of hand-written code lives **co-located** — `invoice-total.ts` sits right next to the
`invoice-total.vow.md` that binds it, not in a separate `lib/`. The unit is "a feature = its vow + its
own code". There is no `components/` or `views/` folder by design: those are generated, never written.

## The two zones

| Zone          | Who writes it                                             | In git?             |
| ------------- | --------------------------------------------------------- | ------------------- |
| `app/`        | you (or the LLM) — vows + the 10 % bind code              | **yes — the truth** |
| `.generated/` | vow — `.ts` / `.vue` / `.test.ts` / `.bind.ts` / the boot | no — regenerated    |

You see only `app/` in the editor — not a codebase. Even the boot (`main.ts`) is generated from the `root: true` page, so there is nothing to hand-wire. `.generated/` is inspectable but never the source, and can't drift.

## The vow types

```
fulfills: emit entity   → a model: type + factory + derived tests (no UI by itself)
fulfills: emit view     → a page from a ## view; its `list:` pulls in entity lists
fulfills: bind …#export → points at hand-written code, verified by tsgo
```

An `entity` vow yields **only the model** — it never renders by itself. A view puts it on the page by listing it (`list: task`), which emits its CRUD list (`Task.vue`). One rule: views render, entities are data.

::: warning Roadmap
The entry page (`root: true`) exists; **routing across multiple pages**, auth, and the **data adapter** (in-memory → Cloudflare D1 for real persistence) are still to come. Today CRUD runs on local component state.
:::
