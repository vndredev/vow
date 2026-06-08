---
group: Introduction
order: 4
---

# Architecture

vow turns a folder of vows into a generated app. The packages are split by **kind**, not by feature — so the logic is written once, the look swaps freely, and a new framework is just another adapter.

## The path

```
app/*.vow.md  →  parse (@vow/core)  →  emit (.ts / .vue)  →  plugin writes .generated/  →  router mounts it, shell wraps it
```

One plugin (`@vow/vite-plugin`) drives it: it loads `app/`, runs the emitters, writes `.generated/`, and serves the result. Change a vow, and the whole path re-runs.

## The layers

| Layer            | Package                                                  | What it is                                                                                 |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **spec & proof** | `@vow/core` · `@vow/gate`                                | the vow primitive (parse the `.vow.md`) + the gate (every promise needs a green test)      |
| **logic**        | `@vow/headless`                                          | framework-free behaviour — ARIA, keyboard, state — proven against the DOM, not a framework |
| **model**        | `@vow/component`                                         | the framework-agnostic component IR both the emitters speak                                |
| **emitters**     | `@vow/emit-{entity,view,primitive,bind}` · `@vow/layout` | turn the spec into `.ts` / `.vue`                                                          |
| **runtime**      | `@vow/store` · `@vow/router`                             | what the generated app imports as it runs                                                  |
| **look**         | `@vow/theme`                                             | the design tokens + the base CSS                                                           |
| **chrome**       | `@vow/docs` · `@vow/shell`                               | the hand-written Vue frame — the docs site · the app dashboard                             |

The split has one rule: `@vow/headless` holds **only logic** — no component, no CSS. That's why React or Solid would reuse it untouched, and why the look is a swappable layer.

## The UI, top down

An app is a **shell** wrapping **views**:

```
App  →  Shell  →  Views (pages)  →  blocks: layout + primitives
```

- A [**shell**](/guide/shell) is the frame — a sidebar + content — wrapping every routed page.
- A [**view**](/guide/views) is a page (a `## view`): a list of blocks — semantic ones (`hero`, `list`), [layout](/guide/views#layout-primitives) ones (`stack`, `grid`), [primitives](/guide/primitives) (`button`, `select`), and `link:`s.
- A [**primitive**](/guide/primitives) is one control: a framework-free core + a generated Vue adapter.

## The mental model

You write **intent** (a vow) → vow **proves** it (a test per promise) → vow **generates** the app (code you own). You never edit the output; the vow is the truth, and it can't drift.
