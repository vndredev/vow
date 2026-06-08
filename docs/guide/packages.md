---
group: Reference
order: 0
---

# Packages

vow is a pnpm monorepo of small, focused packages, split by **kind** (see [Architecture](/guide/architecture) for the layers + the pipeline). Every `@vow/*` package, what it does, and where to learn it:

## Spec & proof

| Package              | Role                                                                         | Learn it                                                |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| `@vow/core`          | the vow primitive — parse + **serialize** `.vow.md`, load the tree, validate | [The Vow primitive](/guide/vow) · [proof](/guide/proof) |
| `@vow/gate`          | the scenario-coverage gate — every promise needs a green test                | [proof](/guide/proof)                                   |
| `@vow/observability` | reads the truth (git today; coverage + CI next) into a derived timeline      | [proof](/guide/proof) · [roadmap](/guide/roadmap)       |

## Model & logic

| Package          | Role                                                                     | Learn it                                 |
| ---------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| `@vow/component` | the framework-agnostic component IR both emitters speak                  | [The component model](/guide/components) |
| `@vow/headless`  | framework-free behaviour (ARIA, keyboard, state), proven against the DOM | [Primitives](/guide/primitives)          |

## Emitters (spec → code)

| Package               | Role                                                          | Learn it                                    |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| `@vow/emit-entity`    | an `emit entity` → a zod model + factory + derived tests      | [emit](/guide/emit)                         |
| `@vow/emit-view`      | an `emit view` / `emit form` → a page, an entity list, a form | [emit](/guide/emit) · [Views](/guide/views) |
| `@vow/emit-primitive` | the thin Vue adapter over each `@vow/headless` primitive      | [Primitives](/guide/primitives)             |
| `@vow/emit-bind`      | the `bind` anchor tsgo verifies                               | [bind](/guide/bind)                         |
| `@vow/layout`         | the layout primitives (Flex · Stack · Grid · Box · Container) | [Views](/guide/views#layout-primitives)     |

## Runtime & look

| Package       | Role                                                           | Learn it                                        |
| ------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `@vow/store`  | the shared in-memory collection per entity (the data adapter)  | [Data](/guide/data)                             |
| `@vow/db`     | the local SQLite data layer (`node:sqlite`); D1 in prod        | [Data](/guide/data)                             |
| `@vow/router` | the tiny client router every generated boot wires in           | [Data](/guide/data) · [App shell](/guide/shell) |
| `@vow/theme`  | the swappable design tokens + the base CSS over the hooks      | [Theming](/guide/theming)                       |
| `@vow/icons`  | a semantic icon set behind swappable library adapters (Lucide) | [Button · Icon](/guide/primitives/button#icon)  |

## Chrome (hand-written Vue) & orchestration

| Package            | Role                                                             | Learn it                                                                |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `@vow/shell`       | the app-chrome layer — the dashboard shell                       | [App shell](/guide/shell)                                               |
| `@vow/docs`        | the docs-chrome layer — scans markdown into a generated doc app  | [The doc-system](/guide/doc-system)                                     |
| `@vow/markdown`    | markdown → vow's UiNode model (+ Shiki, `:::`, `:badge`/`:icon`) | [The doc-system](/guide/doc-system)                                     |
| `@vow/vite-plugin` | the plugin that loads `app/`, generates, and serves              | [Architecture](/guide/architecture) · [App structure](/guide/structure) |
| `@vow/mcp`         | the MCP server — an agent operates the studio (structure + data) | [The MCP server](/guide/mcp)                                            |

The split is by kind, never by feature — `@vow/headless` never holds a component or CSS, the look is a swappable layer, and a new framework is just another adapter. The package boundaries stay flat (no nesting); this page is the directory.
