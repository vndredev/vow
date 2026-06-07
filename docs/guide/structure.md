# App structure

A vow app lives in **two zones**: you work in `app/`, and vow writes everything else into `.generated/` — including the boot. There is no hand-written `src/` shell.

## The folder layout

```
my-app/
├─ app/                     YOUR TRUTH — the app as vows (visible, versioned)
│  ├─ landing.vow.md        view → a ## tree (root: true) — the entry page
│  ├─ task.vow.md           entity → model + factory + tests + default CRUD list
│  ├─ invoice-total.vow.md  bind   → fulfills: bind ./invoice-total.ts#computeTotal
│  ├─ invoice-total.ts      the 10% — hand-written code, right beside its vow
│  └─ invoice-total.test.ts its proof (the test names ARE the vow's ## proves)
├─ .generated/             MACHINE OUTPUT (hidden · gitignored · never edited)
│  ├─ task.ts  task.test.ts  Task.vue
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
fulfills: emit entity   → model + factory + derived tests + a default CRUD list
fulfills: emit view     → an extra / different view (of: <entity>)
fulfills: bind …#export → points at hand-written code, verified by tsgo
```

A single `entity` vow yields the model **and** its list — no separate view file for the common case. Add `view` vows only for additional or different views.

::: warning Roadmap
The entry page (`root: true`) exists; **routing across multiple pages**, auth, and the **data adapter** (in-memory → Cloudflare D1 for real persistence) are still to come. Today CRUD runs on local component state.
:::
