---
group: Introduction
order: 5
---

# The workflow — the red line

vow's whole reason is that **the board mirrors reality, 1:1** — and that holds only if every change runs the same path. This is that path: the anchor points of a vow development, each with the check that secures it.

A **✅** means a gate enforces it — it can't be skipped. A **❌** (or **◑**, partial) means it's still on discipline: the work that's left before "perfect" is mechanical.

| #   | Step             | Anchor                       | The check that secures it                                      | Status |
| --- | ---------------- | ---------------------------- | -------------------------------------------------------------- | ------ |
| 1   | **Plan**         | an Issue (element + why)     | the issue template, enforced in CI                             | ✅     |
| 2   | **Pick up**      | Issue → `doing`              | a trigger (board drag · channel · `vow agent run`)             | ❌     |
| 3   | **Spec**         | a gated, self-contained plan | `buildPlan` — STOP conditions + commit stamp                   | ✅     |
| 4   | **Branch**       | never `main`                 | branch protection (PR-only, no admin bypass), **owned by vow** | ✅     |
| 5   | **Develop**      | an isolated worktree         | the framework-neutrality + layer-DAG gates                     | ✅     |
| 6   | **Verify**       | local green                  | `vp check` · `pnpm -r test` · coverage · smoke                 | ✅     |
| 7   | **Document**     | a doc page, 1:1              | the docs-drift gate; a "has-a-doc" gate is still missing       | ◑      |
| 8   | **PR**           | a PR (`Closes #N`)           | CI gates on `vp lint` (no silent-green typecheck)              | ✅     |
| 9   | **Board: doing** | the open PR                  | `deriveIssueStatus` (open + a PR → doing)                      | ✅     |
| 10  | **Merge**        | green → the **agent** merges | the agent-merge step (a red run → a draft, never merged)       | ❌     |
| 11  | **Board: done**  | merged / closed              | `deriveIssueStatus` (closed → done)                            | ✅     |
| 12  | **Reconcile**    | the backlog stays true       | a mechanical reconcile (issues + milestones)                   | ❌     |

## Secured vs missing

The **spine holds** — steps 1, 4, 5, 6, 8, 9, 11 each fail the build or block the action. What's still on discipline:

- **2 · the trigger** — a board drag or a channel event must move an Issue to `doing` and kick the agent (#96, #97).
- **7 · the has-a-doc gate** — docs-drift checks the pages that exist; nothing yet fails an element that ships without one.
- **10 · the agent-merge** — a green PR is merged by the agent; a red run becomes a draft for the human. The loop never merges itself off a red gate.
- **12 · the reconcile** — verify what's DONE, unblock what's BLOCKED, retire what got fixed; today manual (#103).

Each ❌/◑ is a tracked issue. When they're all ✅, a change **cannot reach `main` off-path** — that is what "perfect working" means here.
