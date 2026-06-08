---
group: Git
order: 0
---

# Git

vow's git history isn't just bookkeeping — it's the **source the roadmap reads**. Every merged change becomes a line on the [roadmap timeline](/guide/roadmap), generated, never hand-typed. So the commit + PR format is **standardized and enforced**, not a convention you have to remember.

## The flow

1. Branch off `main` (`feat/…`, `fix/…`, `chore/…`).
2. Build one element, green (`vp check` + `pnpm -r test`), with its doc page.
3. Open a **PR** — fill the template (Summary · What · Proof · Next).
4. CI green, then **squash-merge**. The PR title becomes the single commit on `main`: `type: summary (#N)`.

## The commit template (enforced, not documented)

Every commit and every PR title is a **Conventional Commit** — `type(scope): imperative summary`. That is the fixed template; you only fill it in. It is enforced in two places:

- the **commit-msg hook** (`.vite-hooks/commit-msg` runs commitlint) rejects a bad local commit;
- **CI** (the `Lint PR title` step) rejects a bad PR title — the squash subject the timeline actually reads.

The `type` set is the single source (`packages/observability/src/commit-types.json`) — each one colours its timeline badge:

| Type                                                 | Badge                            | Meaning               |
| ---------------------------------------------------- | -------------------------------- | --------------------- |
| `feat`                                               | :badge[feat]{variant=success}    | a new capability      |
| `fix`                                                | :badge[fix]{variant=warning}     | a bug fix             |
| `perf` · `refactor`                                  | :badge[refactor]{variant=accent} | faster / restructured |
| `revert`                                             | :badge[revert]{variant=danger}   | an undo               |
| `docs` · `chore` · `test` · `style` · `build` · `ci` | :badge[chore]{variant=neutral}   | everything else       |

## The PR template

`.github/PULL_REQUEST_TEMPLATE.md` is a fixed fill-in:

- **Summary** — one line: what, and which roadmap arc it serves.
- **What** — the concrete changes.
- **Proof** — `vp check` · `pnpm -r test` · the doc page, all green.
- **Next** — anything deliberately deferred.

## The dependency chain

This is why the format matters — the path from a commit to the roadmap:

```
your commit / PR title      type: summary
   |  squash-merge
   v
main's history              type: summary (#N)
   |  git log --first-parent main
   v
@vow/observability          parseGitLog  ->  { date, type, title, pr }
   |  variantForType (commit-types.json -- the single source)
   v
@vow/docs ::: timeline      a generated VowTimeline.vue
   |
   v
the roadmap                 a dated, badged, PR-linked entry
```

The same `commit-types.json` drives the commitlint `type-enum` **and** the timeline's badge — so the format the git hook guarantees is exactly the format the timeline reads. There is nothing to keep in sync.
