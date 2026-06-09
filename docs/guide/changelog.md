---
group: Project
order: 0
---

# Changelog

vow's plan lives in **GitHub Issues**; this page is the **history** — every change merged to `main`, read straight from git. Two halves of one truth: the **plan** (forward) and the **changelog** (backward), meeting at the merge.

## The plan is GitHub Issues

Every unit of work is a GitHub issue with a **derived status** — **planned** (open) → **doing** (a PR closes it) → **done** (merged/closed). The studio mirrors the issues **1:1, gh-direct** (no local copy to drift), in the same three views GitHub Projects has: **Table · Board · Roadmap**. The agent operates them over the MCP; `sync_project` writes the derived status onto the Project's Status field, so both sides stay 1:1. The plan is never hand-maintained — it _is_ the issues.

## The changelog is git

The forward plan ends at the merge — which is where the **changelog** begins. `@vow/observability` reads `git log` at build time and renders the merged history below, newest first, each entry badged by its conventional-commit type ([the git format is enforced](/guide/git)). It's **generated, never typed** — it can't drift, because there's nothing to hand-maintain. (Versioning by semver tag is next, so the changelog groups by release, not just by date.)

## The three surfaces

Today one surface ships — **Plan**. The north star is a **studio** that connects all three — **build**, **plan** and **design** — in one place, all from the **same vows**, operated by a person _or_ an LLM:

- **Plan** _(ships today)_ — the GitHub-issue plan (Table · Board · Roadmap), gh-direct and 1:1 synced.
- **Build** _(north star)_ — describe the app as vows; vow generates it (entities · views · forms), type-checked and proven.
- **Design** _(north star)_ — components, tokens and the look are vows too: see, compose and tune the design system in place.

## The history

::: timeline
:::

::: warning Foundation phase
Everything in the changelog is green and live. These docs stay 1:1 with what git actually records — the changelog can't oversell, because it's derived.
:::
