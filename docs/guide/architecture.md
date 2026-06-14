---
group: Introduction
order: 4
---

# Architecture

vow turns a folder of vows into a generated app. This page is what's _under the hood_ — the pipeline and the packages; for your own app's files and zones, see [App structure](/guide/structure).

The packages are split by **kind**, not by feature — so the logic is written once, the look swaps freely, and a new framework is just another adapter.

## The path

```
app/*.vow.md  →  parse (@vow/core)  →  emit (.ts / .vue)  →  plugin writes .generated/  →  router mounts it, shell wraps it
```

One plugin (`@vow/vite-plugin`) drives it: it loads `app/`, runs the emitters, writes `.generated/`, and serves the result. Change a vow, and the whole path re-runs.

## The layers

| Layer            | Package                                                  | What it is                                                                                   |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **spec & proof** | `@vow/core` · `@vow/gate`                                | the vow primitive (parse the `.vow.md`) + the gate (every promise needs a green test)        |
| **logic**        | `@vow/headless`                                          | framework-free behaviour — ARIA, keyboard, state — proven against the DOM, not a framework   |
| **model**        | `@vow/component`                                         | the framework-agnostic component IR both the emitters speak                                  |
| **emitters**     | `@vow/emit-{entity,view,primitive,bind}` · `@vow/layout` | turn the spec into `.ts` / `.vue`                                                            |
| **runtime**      | `@vow/store` · `@vow/router`                             | what the generated app imports as it runs                                                    |
| **look**         | `@vow/theme`                                             | the design tokens + the base CSS                                                             |
| **chrome**       | `@vow/docs` · `@vow/shell`                               | the app frame — the docs site · the app dashboard (migrating onto the model, piece by piece) |

The split has one rule: `@vow/headless` holds **only logic** — no component, no CSS. That's why React or Solid would reuse it untouched, and why the look is a swappable layer. (`@vow/markdown` and `@vow/icons` support the docs chrome; `@vow/vite-plugin` is the plugin that drives the path above.) See **[Packages](/guide/packages)** for the full directory — every package and where to learn it.

A second rule is now **mechanical**: dependencies point only **down** the 4-layer DAG (foundation → emit → composition → orchestration), never up, and never in a cycle — `@vow/gate`'s `layerViolations` fails the build on an upward edge, an unassigned package, or a cycle. The architecture can't quietly erode.

A third rule keeps the framework honest about its **own** design language: every CSS class an emitter writes must be defined in the theme. `@vow/gate`'s `designLanguageViolations` collects every `vow-*` class the emitters write (the static class literals in `@vow/emit-view` + `@vow/emit-primitive`, splitting a compound like `"vow-table vow-issue-table"` into its tokens), collects every `.vow-*` selector across the design-language stylesheets (`@vow/theme`'s `vow.css` plus each consumer layer's own sheet — `@vow/docs`, `@vow/shell`), and fails on any emitted class with no rule. A `.vow-block__el` rule counts as defining its block (a namespace base composed onto a themed primitive); a class built by interpolation (`` `vow-view--${slug}` ``) can't be checked at lint time, so it is **counted**, never silently dropped. The drift this forbids is bespoke unstyled markup — a `<div class="vow-loop__metric">` that ships flat text with no CSS, caught before only by a screenshot. The remedy the gate prints is the correction: **theme the class the token-only way (a `.vow-…` rule in `vow.css` or the consumer layer's sheet), or compose a primitive that already is themed.** vow dogfoods its own design language, by construction.

A fourth rule keeps the prose honest about every **built element**: a registered primitive or view-node with no doc is forbidden. `@vow/gate`'s `undocumentedPrimitives` checks every `PRIMITIVE_ADAPTERS` name against the [primitives](/guide/primitives) corpus (the directory page + each per-primitive page, where a composable part like `CardBody` is named under its parent), and `undocumentedViewNodes` checks every `VIEW_NODE_TYPES` node name against [views.md](/guide/views) — each must appear as a **whole word** (so `card` never spuriously documents `cardBody`). Both are closed registries the author + agent paths validate against (`emit view` rejects an unknown `## view` node; the `add_view` MCP tool publishes the names and validates writes against them), so a name with no doc is a contract no one can read. This is the gate that would have caught the two drifts that shipped before it: a fully-registered, themed `ContextMenu` with no page, and `views.md` naming the node `radio` while the registry calls it `radioGroup` — which broke the agent path (`add_view` rejected `radio`). Adding a registered element without documenting it now fails the build, not a reader.

## The UI, top down

An app is a **shell** wrapping **views**:

```
App  →  Shell  →  Views (pages)  →  blocks: layout + primitives
```

- A [**shell**](/guide/shell) is the frame — a sidebar + content — wrapping every routed page.
- A [**view**](/guide/views) is a page (a `## view`): a list of blocks — semantic ones (`hero`, `list`), [layout](/guide/views#layout-primitives) ones (`stack`, `grid`), [primitives](/guide/primitives) (`button`, `select`), and `link:`s.
- A [**primitive**](/guide/primitives) is one control: a framework-free core + a generated Vue adapter.

## Primitive vs composition

The one rule that keeps the UI model clear: **a primitive doesn't know what app it's in. The moment something knows your entities or data, it's a composition.**

- **Primitives** — generic atoms, no app data: _interactive_ (a [headless](/guide/primitives) core + adapter — checkbox, dialog, select), _structural_ (styled wrappers — button, badge, field, [table](/guide/primitives/table), [card](/guide/primitives/card), stats, callout), or [_layout_](/guide/views#layout-primitives) (flex, grid, stack).
- **Compositions** — primitives **+ data or structure**: the generated **entity list** (`<Task>` composes the Table parts + your fields + the store), the views and forms you write, the docs / shell chrome, the studio surfaces.

`Table` doesn't know `Task`; the entity list does — so `Table` is a primitive and the list is a composition. Build a new primitive only for a generic, reusable control; everything app-specific is a composition over them.

## The mental model

You write **intent** (a vow) → vow **proves** it (a test per promise) → vow **generates** the app (code you own). You never edit the output; the vow is the truth, and it can't drift.
