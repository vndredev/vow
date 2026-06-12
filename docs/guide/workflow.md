---
group: Introduction
order: 5
---

# The workflow — the red line

vow's whole reason is that **the board mirrors reality, 1:1** — and that holds only if every change runs the same path. This is that path: the anchor points of a vow development, each with the check that secures it.

> **What is a plan, here?** The plan **is the issues** — GitHub issues, derived into the studio's board / roadmap (`board ⟂ reality`, 1:1). Not a doc, not a side-file. Claude's plan-mode notes are transient working files, kept **project-local** (via `plansDirectory` → `.claude/plans`, gitignored) so they never leak to a global directory; they feed _into_ issues, they are never themselves the plan.

A **✅** means a gate enforces it — it can't be skipped. A **❌** (or **◑**, partial) means it's still on discipline: the work that's left before "perfect" is mechanical.

| #   | Step             | Anchor                       | The check that secures it                                                          | Status |
| --- | ---------------- | ---------------------------- | ---------------------------------------------------------------------------------- | ------ |
| 1   | **Plan**         | an Issue (element + why)     | the issue template, enforced in CI                                                 | ✅     |
| 2   | **Pick up**      | Issue → `doing`              | a trigger — the board's **Start work** action (→ `/__vow/agent` → `vow agent run`) | ◑      |
| 3   | **Spec**         | a gated, self-contained plan | `buildPlan` — STOP conditions + commit stamp                                       | ✅     |
| 4   | **Branch**       | never `main`                 | branch protection (PR-only, no admin bypass), **owned by vow**                     | ✅     |
| 5   | **Develop**      | an isolated worktree         | the framework-neutrality + layer-DAG gates                                         | ✅     |
| 6   | **Verify**       | local green                  | `vp check` · `pnpm -r test` · coverage · smoke                                     | ✅     |
| 7   | **Document**     | a doc page, 1:1              | the docs-drift gate; a "has-a-doc" gate is still missing                           | ◑      |
| 8   | **PR**           | a PR (`Closes #N`)           | CI gates on `vp lint` (no silent-green typecheck)                                  | ✅     |
| 9   | **Board: doing** | the open PR + a watch link   | `deriveIssueStatus` (open + a PR → doing); the issue links its PR (the run)        | ✅     |
| 10  | **Merge**        | green → the **agent** merges | the agent-merge step (a red run → a draft, never merged)                           | ❌     |
| 11  | **Board: done**  | merged / closed              | `deriveIssueStatus` (closed → done)                                                | ✅     |
| 12  | **Reconcile**    | the backlog stays true       | a mechanical reconcile (issues + milestones)                                       | ❌     |

## Secured vs missing

The **spine holds** — steps 1, 4, 5, 6, 8, 9, 11 each fail the build or block the action. What's still on discipline:

- **2 · the trigger** — the issue board's **Start work** button POSTs a start-work signal to `/__vow/agent`; the dev server dispatches `vow agent run <n>` for that issue (injecting its number/title/body), and the run's PR is what derives `doing`. The human's one signal to begin; the status stays derived (no status hack). The remaining ◑ is the production channel (a Worker over the GitHub API, beside the dev-server path) and the real MCP-notification surface (#97's research-preview half).
- **7 · the has-a-doc gate** — docs-drift checks the pages that exist; nothing yet fails an element that ships without one.
- **10 · the agent-merge** — a green PR is merged by the agent; a red run becomes a draft for the human. The loop never merges itself off a red gate.
- **12 · the reconcile** — verify what's DONE, unblock what's BLOCKED, retire what got fixed; today manual (#103).

Each ❌/◑ is a tracked issue. When they're all ✅, a change **cannot reach `main` off-path** — that is what "perfect working" means here.
