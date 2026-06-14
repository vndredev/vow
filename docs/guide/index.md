---
group: Introduction
order: 0
---

# What is vow?

vow is a **spec-driven, LLM-first generator** on the [VoidZero](https://voidzero.dev/) toolchain (Vite+, Vitest, oxlint). You describe your app as a tree of **vows** — promises — and vow generates a type-safe app that you own. No runtime, no lock-in: the generated code is yours. It's **Vue today**, but the component model is **framework-agnostic** — React and Solid are adapters over the same core, not a rewrite.

::: warning Foundation phase
vow is young. The core mechanism on these pages works end-to-end; the surface (UI patterns, persistence, a CLI) is still growing. These docs are kept in sync as it does.
:::

## The idea

A _vow_ is a promise about your app's behaviour. Instead of hand-writing a codebase, you write the **intent** and the **proof** — and vow keeps the promise:

```
app/<slug>.vow.md     your truth — visible, versioned
    │
    ▼  vow() Vite plugin generates
.generated/           the code — hidden, never edited
    │
    ▼  tsgo type-checks
your app              proven by scenario-coverage
```

The visible `app/` folder holds the vows. The generated `.vue` / `.ts` lives in `.generated/`, which you can inspect but never edit — it is regenerated, so it can't drift from the truth.

## Why

- **No drift.** What can be generated is never the source. The vow is the single truth; the code is a projection.
- **Governed.** Every promise needs a named test, or the gate is red — for `emit`, the generated test proves the behaviour; for `bind`, you own the assertion (see [proof](/guide/proof)).
- **Yours.** vow is a generator, not a runtime — the output is plain code (Vue today), yours to keep.

Next: [Getting started →](/guide/getting-started)
