---
name: vow-orchestrate
description: Run a LIVE fleet of vow agents — one per issue, developing through vow's gated loop, watchable. Use when the user wants several vow issues developed at once and wants to see it happen.
---

# Orchestrate a vow agent fleet (live)

The user wants several vow issues developed at once AND wants to watch it happen. In Claude Code, drive this through the host's **Workflow tool** — it renders a live view (`/workflows`: phases, agents, progress). A bash `vow agent run-all` is PASSIVE — the user sees nothing until it finishes — so it is NOT the in-session path.

## The workflow

Write a workflow that fans out one agent per issue. Each agent:

1. Reads its gated plan: `vow agent plan <n>` — the self-contained, verification-gated task (it already carries the issue's area specialist focus).
2. Develops it on a `feat/issue-<n>` branch / its own worktree, staying strictly in scope.
3. Verifies: `vp check` = 0 AND `pnpm -r test` = 0.
4. Opens a PR with `Closes #<n>`. Green → mergeable; red → a draft (surfaced, never auto-merged).

Return one line per issue (the PR + the verdict). The user watches every lane live via `/workflows`.

## Why through the host

vow owns the **substance** — the gated plan, the gates, the issues, the area specialists. The host owns the **runtime + the live view**. "Alles ueberall": in another host, another runtime. The work always lands back in vow's issues, never a side-file.

## Single issue / headless

One issue, no watching → `vow agent run <n>`. Headless / CI (no live view needed) → `vow agent run-all <n>...` (add `--json` to pipe the NDJSON to a UI).
