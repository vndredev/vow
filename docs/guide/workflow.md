---
group: Introduction
order: 5
---

# The workflow — the red line

vow's whole reason is that **the board mirrors reality, 1:1** — and that holds only if every change runs the same path. This is that path: the anchor points of a vow development, each with the check that secures it.

> **What is a plan, here?** GitHub issues are the plan's **external skin**; vow's own **local plan** (a SQLite DAG the studio renders as Now + Next · Backlog · Map) is the structure built on them. Not a doc, not a side-file. Claude's plan-mode notes are transient working files, kept **project-local** (via `plansDirectory` → `.claude/plans`, gitignored) so they never leak to a global directory; they feed _into_ issues, they are never themselves the plan.

A **✅** means a gate enforces it — it can't be skipped. A **❌** (or **◑**, partial) means it's still on discipline: the work that's left before "perfect" is mechanical.

| #   | Step             | Anchor                       | The check that secures it                                                                                                           | Status |
| --- | ---------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **Plan**         | an Issue (element + why)     | the issue template, enforced in CI                                                                                                  | ✅     |
| 2   | **Pick up**      | Issue → `doing`              | the loop claims it (a local `plan_session`) the moment it starts — dispatched by the loop or `vow agent run <n>` (→ `/__vow/agent`) | ◑      |
| 3   | **Spec**         | a gated, self-contained plan | `buildPlan` — STOP conditions + commit stamp                                                                                        | ✅     |
| 4   | **Branch**       | never `main`                 | branch protection (PR-only, no admin bypass), **owned by vow**                                                                      | ✅     |
| 5   | **Develop**      | an isolated worktree         | the framework-neutrality + layer-DAG gates                                                                                          | ✅     |
| 6   | **Verify**       | local green                  | `vp check` · `pnpm -r test` · coverage · smoke                                                                                      | ✅     |
| 7   | **Document**     | a doc page, 1:1              | the docs-drift gate; a "has-a-doc" gate is still missing                                                                            | ◑      |
| 8   | **PR**           | a PR (`Closes #N`)           | CI gates on `vp lint` (no silent-green typecheck)                                                                                   | ✅     |
| 9   | **Board: doing** | the open PR + a watch link   | `deriveIssueStatus` (open + a PR closing it → doing); the issue links its PR (the run)                                              | ✅     |
| 10  | **Merge**        | green → the **agent** merges | `vow agent merge` — polls CI's `gate`, merges a green PR (squash + delete-branch), drafts a red run, never merged                   | ✅     |
| 11  | **Board: done**  | merged / closed              | `deriveIssueStatus` (closed → done)                                                                                                 | ✅     |
| 12  | **Reconcile**    | the backlog stays true       | `vow reconcile` surfaces the retire candidates (open issues a merged PR already closed)                                             | ✅     |

## Secured vs missing

The **spine holds** — steps 1, 4, 5, 6, 8, 9, 10, 11, 12 each fail the build, block the action, or run mechanically. What's still on discipline:

- **2 · the trigger** — the loop (or a person) dispatches `vow agent run <n>` via the `/__vow/agent` seam; the dev server resolves the issue (injecting its number/title/body) and spawns the run. The loop claims the issue the moment it starts — a local `plan_session` (its branch + worktree), reconciled against the live PRs every round — so vow owns the in-flight `doing` state, never a GitHub label that orphans. The human's one signal to begin; the status stays derived. The remaining ◑ is the production channel (a Worker over the GitHub API, beside the dev-server path) and the real MCP-notification surface (#97's research-preview half).
- **7 · the has-a-doc gate** — docs-drift checks the pages that exist; nothing yet fails an element that ships without one.

What's now secured:

- **10 · the agent-merge** — `vow agent merge` polls CI's `gate` and acts on the verdict: a green PR is merged by the agent (squash + delete-branch), a red run becomes a draft for the human. The loop never merges itself off a red gate.
- **12 · the reconcile** — `vow reconcile` surfaces the retire candidates (open issues a merged PR already closed, e.g. the second of a `Closes #a, #b` list GitHub's auto-close missed), so the backlog can be brought back to 1:1 with reality.

Each ◑ is a tracked issue. When they're all ✅, a change **cannot reach `main` off-path** — that is what "perfect working" means here.
