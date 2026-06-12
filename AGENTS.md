# AGENTS.md

This repo is **vow** — a spec-driven, LLM-first generator. It is agent-native: you develop it THROUGH vow,
on one red line, every step gated. Read this before changing anything.

## The red line (every change runs it)

1. **Plan** — an issue (element + why). The plan lives in GitHub issues / the studio, never a side-file.
2. **Branch** — `<type>/<slug>` (feat/fix/docs/…), never `main`. main is PR-only (no admin bypass).
3. **Develop** — in an isolated worktree, one coherent element.
4. **Verify** — `vp check` = 0 AND `pnpm -r test` = 0 (a gate in another package may scan yours).
5. **Document** — every package has a row in `docs/guide/packages.md`; every element a doc page.
6. **PR** — `Closes #N` (every PR links an issue).
7. **Merge** — the agent merges when CI's `gate` is green; a red run becomes a draft.

## The gates (mechanical, not pleas)

framework-neutrality (no raw framework templates outside the component model) · layer-DAG (no upward
imports) · provider-neutrality (a provider CLI only behind the provider seam) · has-a-doc · coverage ·
docs-drift · branch-protection · pr-title (commitlint) · pr-body (fill the template — Summary / What /
Proof / Next, not a bare `Closes #N`). A gate fails the build; that is the point.

## Commands

- `vp check` — fmt + lint + typecheck (tsgo). Must be 0. Never `vp check --fix` (use `vp fmt`).
- `pnpm -r test` — every package's tests (project-local bins + the jsdom peer). NOT `vp test` (the global
  `vp` can't resolve project-local optional peers like jsdom).
- `vp build apps/<app>` / `vp dev apps/<app>` — generate `.generated/` + build / dev-serve with HMR.
- `vow guard` — enforce main's protection. `vow reconcile` — surface backlog drift.

## Way of working

- **Slow — element by element, function by function.** Plan first, then build. Per element: code → green
  (`vp check` + `pnpm -r test`) → its doc page → present → next. A PR is ONE coherent element.
- **The docs are the traceable truth** — for a person and an LLM. Maintain them with EVERY change, **1:1 to
  the real state**, honest (mark the Foundation phase), no overselling.
- **Commit when green.** Don't present mocks as real data; fix the root cause, not the symptom.
- **English only** across code + docs — a gate enforces it (no umlauts).
- **90% mechanics, 10% LLM** — anything forceable is a rule / gate / hook, never a plea in this file.

## Pitfalls

- vows are `<slug>.vow.md` (slug IN the filename); an `id` matches `^[a-z]+_[a-z0-9]+$` — exactly ONE
  underscore (`vow_task`, not `vow_invoice_total`).
- `app/` (vows = truth, versioned) ⟂ `.generated/` (machine output, gitignored, **NEVER edited**).
- Restart a running `vp dev` after an emitter change before `vp check` — it regenerates `.generated` with
  the OLD emitter → phantom errors.
- Test a11y **against the platform** (vanilla DOM + axe), not a framework — the truth lives in the headless
  core; the adapter only forwards.
- The docs are a **generated vow app** (`apps/docs`): content stays plain `.md` in `/docs`, scanned by
  `@vow/docs`, rendered through the core. No parallel doc-system.

## The toolchain

vow runs on **Vite+** (`vp` — Vite / Rolldown / Vitest / oxlint / oxfmt / tsgo in one CLI; distinct from
Vite, which `vp` invokes). Docs: `node_modules/vite-plus/docs` or https://viteplus.dev/guide/. Run
`vp install` after pulling; `vp env doctor` when setup looks wrong.

## The principle

Everything flows through vow (issues · the agent loop · vow's own workflows), nothing around it. Reaching
for a side-file or an ad-hoc parallel IS the drift vow exists to prevent. This file — **AGENTS.md** — is the
single, provider-neutral contract every agent follows; there is no per-tool variant.
