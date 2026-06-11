---
name: vow-develop
description: Develop an issue through vow's red line — branch, verify, PR, agent-merge. Use when picking up a vow issue.
---

# Develop through vow

Read `AGENTS.md` first — it is the contract. To develop an issue:

1. Branch `<type>/<slug>` off main.
2. Make the change; keep it one coherent element.
3. Verify: `vp check` = 0 AND `pnpm -r test` = 0.
4. PR with `Closes #N`. Watch the CI `gate`.
5. When green, merge with `gh pr merge <N> --squash --delete-branch`. Red → leave a draft.

The plan is the GitHub issues (run `vow reconcile` to check the board is honest). Never a side-file.
