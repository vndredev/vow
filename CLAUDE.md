# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repo.

## What this is

**vow** — a **spec-driven, LLM-first generator for Vue**. You describe the app as a tree of **vows** (promises) in `app/<slug>.vow.md`; vow generates a type-safe Vue app into `.generated/` that you own (no runtime lock-in). Fully on the **VoidZero** stack (Vite+, Vitest, oxlint/oxfmt, tsgo), target backend Cloudflare. A pnpm monorepo with the `vp` CLI.

**Guiding star:** build a complete **dashboard / planning-system app** with the core product — operable by a user **and** an LLM. Approach: slow, element by element, function by function.

## Commands

- `vp check` — fmt + lint + typecheck (tsgo) across all packages. Must be green.
- **`pnpm -r test`** — tests per package (local `.bin`). **NOT `vp test`** (root): the global `vp` can't resolve project-local optional peers like `jsdom`.
- `vp build apps/demo` — generates `.generated/` + builds the bundle.
- `vp dev apps/demo` — dev server (HMR: change `app/*.vow.md` → regenerates + reloads).
- `pnpm --filter @vow/docs run docs:build` / `docs:dev` — the VitePress docs.
- pre-commit (`vp staged`) runs `vp check --fix`.

## Architecture (the contract)

**The Vow primitive** (`@vow/core`): ONE recursive node `{ id, slug, intent, kind?, of?, fields, fulfills?, proof }`. **Status is NEVER stored** (derived). `parse.ts` (vow.md → Vow), `load.ts` (folder tree → forest), `coverage.ts` (scenario-coverage).

**Fulfilment — how a vow is redeemed:**

- `emit entity` → `<slug>.ts` (type + validating `create<Name>` factory) + `<slug>.test.ts` (derived from `## fields`) + `<Name>.vue` (default CRUD list). [`@vow/emit-entity`, `@vow/emit-view`]
- `emit view` (`of: <entity>`) → an additional `.vue` view over the same entity. [`@vow/emit-view`]
- `bind <module>#<export>` → hand-written code; vow generates only a `.bind.ts` anchor that **tsgo** verifies (the seam can't lie). [`@vow/emit-bind`]

**The component model** (`@vow/component`): the `.vue` emitters build a canonical, framework-agnostic `Component` (props/events/imports/setup + a `UiNode` view tree with adapter-neutral expression strings) and render it via `renderVueSfc`. React/Solid become further adapters over the same model — byte-stable output, pinned by tests.

**Primitives (headless, a11y):** `@vow/headless` = framework-agnostic core (`checkbox(state,set)→api` — ARIA/keyboard logic), whose **a11y is tested against the platform** (vanilla DOM + axe, no framework). `@vow/emit-primitive` generates the **unstyled** Vue adapter (only `class` + `data-*` hooks). Only build what HTML can't do natively — **no Button** (`<button>` is already accessible).

**Three zones:** `app/` (vows = truth, versioned) ⟂ `.generated/` (output, gitignored, NEVER edited) ⟂ `src/` (thin boot shell: `main.ts` + shims).

**Styling:** `@vow/theme` = swappable `vow.css` over the `class`/`data-*` hooks. Adapters stay unstyled; the theme is optional (or replaceable by vndre.dev tokens) — no component change.

**Gate:** `@vow/gate` (`runGate`) generates first, then collects every prove across the whole forest + every test name in the corpus, and requires via `uncoveredScenarios`: **every prove has a green test** (else red). A **docs-drift gate** also re-parses the docs' vow.md examples against the real core and checks type-drift (every `Attr`/`UiNode` kind in `components.md`, every `FieldType` in `emit.md`). Wired as an app test.

**Plugin:** `@vow/vite-plugin` (`vow()`) loads `app/`, generates `.generated/`, exposes `virtual:vow/tree`, watches `app/*.md` for HMR.

## Conventions & pitfalls

- vows as **`<slug>.vow.md`** (slug IN the filename, no "index.js trap"). Nesting via a same-named `<slug>/` folder.
- `id`: regex `^[a-z]+_[a-z0-9]+$` — **exactly ONE underscore** (`vow_task`, not `vow_invoice_total`).
- Run tests **always** via `pnpm -r test` (local bins, jsdom peer). The global `vp test` breaks on `jsdom`.
- Test **a11y against the platform** (vanilla DOM + axe), not a framework — the truth lives in the headless core; the adapter only forwards.
- **English only** across codebase + docs — enforced by a gate (no umlauts).
- VitePress (`docs/`) runs on its own **upstream Vite** (scoped override `"vitepress>vite"`), not Vite+ (Vite+ dropped `transformWithEsbuild` for oxc). `allowBuilds: esbuild`.
- Side-effect imports (`*.css`, `*.vue`) need a tsgo shim (`src/env.d.ts`).

## Way of working (hard rules, from Andre)

- **Slow, element by element, function by function.** Plan first, then build. Per element: code → green (`vp check` + `pnpm -r test`) → **doc page** → present → Andre approves → next.
- **The docs are the traceable truth** for user + LLM — the place where everything is understood. Maintain them with EVERY feature, **1:1 to the real state**, no overselling, honest (mark the Foundation phase).
- **Commit when green.** Andre pushes interactively.
- Don't present mocks as real data; fix the root cause, not the symptom.

## Roadmap (two strands → dashboard / planning app)

- **Generation** (what vow emits): layout (primitives Flex/Grid/Box/Container + view `## tree` + theme tokens) ✓ → more field types (reference) + relations → primitive ladder (Switch/Dialog/Tabs/Select/Combobox/Table; wrap complex ones via Zag/Ark) → patterns (Form/Table/Detail/Board/Stats) → routing → data adapter (memory → CF D1).
- **Author layer** (LLM-first): `serialize` (Vow → vow.md) → typed mutation API (`addEntity`/`addField`/…) → **vow MCP server** (the LLM operates vow via typed tools).
- **Reference product:** a dashboard / planning system (entities + board/kanban + stats + CRUD + persistence), operable by user + LLM.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
