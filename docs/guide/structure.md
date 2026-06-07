# App structure

A vow app lives in **three zones**: you work in `app/`, vow writes `.generated/`, and `src/` is just the thin boot shell.

## The folder layout

```
my-app/
├─ app/                     YOUR TRUTH — the app as vows (visible, versioned)
│  ├─ landing.vow.md        view   → a ## tree layout (hero + feature grid)
│  ├─ task.vow.md           entity → model + factory + tests + default CRUD list
│  ├─ invoice-total.vow.md  bind   → fulfills: bind ./invoice-total.ts#computeTotal
│  ├─ invoice-total.ts      the 10% — hand-written code, right beside its vow
│  └─ invoice-total.test.ts its proof (the test names ARE the vow's ## proves)
├─ .generated/             MACHINE OUTPUT (hidden · gitignored · never edited)
│  ├─ task.ts  task.test.ts  Task.vue
│  ├─ Checkbox.vue          emitted primitive adapters (over @vow/headless)
│  ├─ landing.vue           the layout view + Flex/Grid/Box/Container primitives
│  └─ invoice-total.bind.ts bind anchor (tsgo verifies the seam)
├─ src/                     thin, stable shell (set up once)
│  ├─ main.ts               boots the generated app + imports the theme
│  └─ vow-modules.d.ts      *.vue / *.css shims
├─ index.html
├─ vite.config.ts           plugins: [vue(), vow()]
├─ tsconfig.json            include: ["src", "app", ".generated"]
└─ package.json             @vow/headless · @vow/theme · vue
```

The 10 % of hand-written code lives **co-located** — `invoice-total.ts` sits right next to the
`invoice-total.vow.md` that binds it, not in a separate `lib/`. The unit is "a feature = its vow + its
own code". There is no `components/` or `views/` folder by design: those are generated, never written.

## The three zones

| Zone          | Who writes it                                  | In git?             |
| ------------- | ---------------------------------------------- | ------------------- |
| `app/`        | you (or the LLM) — vows + the 10 % bind code   | **yes — the truth** |
| `.generated/` | vow — `.ts` / `.vue` / `.test.ts` / `.bind.ts` | no — regenerated    |
| `src/`        | once, then stable                              | yes                 |

You see only `app/` in the editor — not a codebase. `.generated/` is inspectable but never the source, and can't drift.

## The vow types

```
fulfills: emit entity   → model + factory + derived tests + a default CRUD list
fulfills: emit view     → an extra / different view (of: <entity>)
fulfills: bind …#export → points at hand-written code, verified by tsgo
```

A single `entity` vow yields the model **and** its list — no separate view file for the common case. Add `view` vows only for additional or different views.

::: warning Roadmap
The **app root** (`app.vow.md`: shell, routing across views, auth), the **data adapter** (in-memory → Cloudflare D1 for real persistence), and richer views are still to come. Today CRUD runs on local component state.
:::
