---
group: Git
order: 0
---

# Git

vow's git history isn't just bookkeeping — it's the **source the changelog reads**. Every merged change becomes a line on the [changelog timeline](/guide/changelog), generated, never hand-typed. So the commit + PR format is **standardized and enforced**, not a convention you have to remember.

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

| Type                                                 | Badge                         | Meaning               |
| ---------------------------------------------------- | ----------------------------- | --------------------- |
| `feat`                                               | :badge[feat]{tone=success}    | a new capability      |
| `fix`                                                | :badge[fix]{tone=warning}     | a bug fix             |
| `perf` · `refactor`                                  | :badge[refactor]{tone=accent} | faster / restructured |
| `revert`                                             | :badge[revert]{tone=danger}   | an undo               |
| `docs` · `chore` · `test` · `style` · `build` · `ci` | :badge[chore]{tone=neutral}   | everything else       |

## The PR template

`.github/PULL_REQUEST_TEMPLATE.md` is a fixed fill-in:

- **Summary** — one line: what, and which roadmap arc it serves.
- **What** — the concrete changes.
- **Proof** — `vp check` · `pnpm -r test` · the doc page, all green.
- **Next** — anything deliberately deferred.

## The dependency chain

This is why the format matters — the path from a commit to the changelog:

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
the changelog               a dated, badged, PR-linked entry
```

The same `commit-types.json` drives the commitlint `type-enum` **and** the timeline's badge — so the format the git hook guarantees is exactly the format the timeline reads. There is nothing to keep in sync.

## The GitHub side — the issue plan

The timeline above is **Done** — merged history. The forward plan lives the same way, read from the truth: **GitHub issues**. `@vow/observability`'s GitHub side (`github.ts`) reads them via `gh` and **derives** each issue's status — the same "never stored, always derived" rule as a vow's.

```
gh issue list --json …   ->  parseIssues    ->  { number, title, state, labels, assignees }
gh pr list   --json …    ->  linkedIssues   ->  the issues an open PR closes (Closes #N)
   |  deriveIssueStatus
   v
issuePlan(cwd)           ->  [{ issue, status }]      status: planned | doing | done
```

- **done** — the issue is closed.
- **doing** — open, and either an open PR closes it (`Closes #N` · `Fixes #N` · `Resolves #N`) **or** it carries the `in-progress` label (an agent is developing it right now). The agent applies the label the moment it claims the issue and removes it when the run ends, so the board shows `doing` across the whole **develop → PR → merge** arc, not only once the PR exists.
- **planned** — open, no PR and not being developed.

`statusVariant` colours each — planned → :badge[planned]{tone=neutral} · doing → :badge[doing]{tone=accent} · done → :badge[done]{tone=success}. Like `gitTimeline`, the reads are **graceful**: no `gh`, no auth, no network ⇒ `[]`, so a build without GitHub simply has no issue plan. This is the read foundation the MCP's `list_issues` and the GitHub Project's status sync build on.

The studio, though, no longer renders this GitHub plan directly. The issue plan is the **external skin**; the studio's plan surface (Now + Next · Backlog · Map) is vow's **own local plan** — a SQLite DAG of work read over `/__vow/plan`. GitHub issues bind to it: a plan item carries the `issue` it mirrors, and the MCP's `sync_plan` pulls the live issues in (an open issue with no item yet → a `backlog` item; a closed issue's item → `done`). So a person filing an issue still reaches the plan, but the rich structure GitHub can't model — the lifecycle, the dependency DAG, the ready-queue — lives locally.

### The plan is driven, not clicked

The studio's plan views are **read-only**. The plan is operated by the agent, the loop, and the MCP — `add_plan_item`, `set_plan_status` (through the vow-owned lifecycle), `add_plan_dep`, `set_plan_priority`, `sync_plan` — never by per-card buttons in the browser. **Status stays derived**: a closed GitHub issue syncs its item to `done`, and a run's PR is what closes the issue. The agent-dispatch seam stays (`/__vow/agent` resolves an issue and spawns **`vow agent run <n>`**, detached) — but it is the loop's lever, not a button beside every card. GitHub remains the single external source; the local plan is the structure built on top of it.
