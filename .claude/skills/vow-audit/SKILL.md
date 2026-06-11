---
name: vow-audit
description: Audit the codebase via a live fleet of agents — findings become vow issues (the plan), never a side-file. Use when the user wants a multi-agent audit of the code.
---

# Audit through vow (live)

The user wants a multi-agent audit whose findings become vow ISSUES (the plan), never a side-file. In Claude Code, drive it through the host's **Workflow tool** (live via `/workflows`).

## The workflow

Fan out one agent per dimension (correctness, security, performance, types, tests, docs, …). Each agent:

1. Gets its instruction: `vow agent audit --prompt <dimension>` — review read-only, output a JSON array of findings (`{title, area, evidence, fix}`).
2. Audits the codebase — it edits NOTHING.
3. Returns its findings JSON.

Collect every agent's findings into one `findings.json`, then file them: `vow agent audit --file findings.json` — each becomes a labelled, milestoned vow issue. The user watches every lane via `/workflows`.

## Why

The audit → plan flow is vow's own: findings ARE issues, never a `.claude/plans` side-file. The host gives the live runtime + view; vow gives the prompt, the filing, and the issues.
