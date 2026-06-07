# Contributing to vow

vow is built **slowly** — element by element, function by function. Every change ships green and with its own doc page. Two audiences contribute: humans (this file) and LLMs/agents (see `CLAUDE.md`, and the planned `llms.txt`).

## Setup

```bash
pnpm install            # vp config runs the git hooks setup
vp dev apps/starter        # the starter app
```

`vp` is the global [Vite+](https://viteplus.dev/) CLI (the toolchain). vow is a pnpm monorepo of `@vow/*` packages.

## The gate (must be green)

```bash
vp check                # format (oxfmt) · lint (oxlint) · typecheck (tsgo)
pnpm -r test            # tests, per package — NOT `vp test` (the global vp can't
                        # resolve project-local optional peers like jsdom)
vp build apps/starter      # generate .generated/ + build
pnpm --filter @vow/docs run docs:build
```

## How a change works

1. Build the element (often: a `@vow/headless` core, an emitter, a test).
2. Make it green (`vp check` + `pnpm -r test`).
3. **Write its doc page** — the docs are the single, honest source of how vow works.
4. Add a changeset _(once releases are set up)_ and open a PR.

## Architecture discipline

- **Use the foundation, don't rebuild it.** vow is the intent layer on VoidZero/Vite+. Reach for Vite+ (hooks, monorepo, build), Zag/Ark (complex primitives), VitePress (docs) — don't reinvent them.
- **Framework code lives only in the emit layer.** `@vow/core`, `@vow/headless`, `gate`, `theme` are framework-agnostic; only `emit-*` is Vue-specific. (React/Solid/Svelte targets come later over the same core.)
- **`app/` is the truth; `.generated/` is never edited.** The vow tree is the source; generated code is a projection.
- **a11y is tested against the platform, not a framework** (vanilla DOM + axe in the headless core).

## Commits & branches

- **Conventional Commits**, enforced by commitlint: `feat(emit-view): …`, `fix(core): …`, `docs:`, `chore`, `refactor`, `test`, `build`, `ci`, `perf`, `style`.
- Work on `feat/…` / `fix/…` branches → open a **PR**. CI must be green before merge; direct pushes to `main` are reserved for maintainers.

## Docs as the contract

The `docs/` guide is where anyone — human or LLM — understands how vow works, **1:1 with the built state**. Keep it honest: no overselling, mark anything unfinished as roadmap.
