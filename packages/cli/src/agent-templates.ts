/** The `AGENTS.md` contract — the provider-neutral instructions any coding agent follows in this repo. */
export function agentsMd(): string {
  return `# AGENTS.md

This repo is **vow** — a spec-driven, LLM-first generator. It is agent-native: you develop it THROUGH vow,
on one red line, every step gated. Read this before changing anything.

## The red line (every change runs it)

1. **Plan** — an issue (element + why). The plan lives in GitHub issues / the studio, never a side-file.
2. **Branch** — \`<type>/<slug>\` (feat/fix/docs/…), never \`main\`. main is PR-only (no admin bypass).
3. **Develop** — in an isolated worktree, one coherent element.
4. **Verify** — \`vp check\` = 0 AND \`pnpm -r test\` = 0 (a gate in another package may scan yours).
5. **Document** — every package has a row in \`docs/guide/packages.md\`; every element a doc page.
6. **PR** — \`Closes #N\` (every PR links an issue).
7. **Merge** — the agent merges when CI's \`gate\` is green; a red run becomes a draft.

## The gates (mechanical, not pleas)

framework-neutrality (no raw framework templates outside the component model) · layer-DAG (no upward
imports) · provider-neutrality (a provider CLI only behind the provider seam) · has-a-doc · coverage ·
docs-drift · branch-protection. A gate fails the build; that is the point.

## Commands

- \`vp check\` — fmt + lint + typecheck. Must be 0.
- \`pnpm -r test\` — every package's tests.
- \`vow guard\` — enforce main's protection. \`vow reconcile\` — surface backlog drift.

## The principle

Everything flows through vow (issues · the agent loop · vow's own workflows), nothing around it. Reaching
for a side-file or an ad-hoc parallel IS the drift vow exists to prevent.
`;
}

/** The \`/vow-develop\` skill — points a session at the develop flow + the AGENTS.md contract. */
export function vowDevelopSkill(): string {
  return `---
name: vow-develop
description: Develop an issue through vow's red line — branch, verify, PR, agent-merge. Use when picking up a vow issue.
---

# Develop through vow

Read \`AGENTS.md\` first — it is the contract. To develop an issue:

1. Branch \`<type>/<slug>\` off main.
2. Make the change; keep it one coherent element.
3. Verify: \`vp check\` = 0 AND \`pnpm -r test\` = 0.
4. PR with \`Closes #N\`. Watch the CI \`gate\`.
5. When green, merge with \`gh pr merge <N> --squash --delete-branch\`. Red → leave a draft.

The plan is the GitHub issues (run \`vow reconcile\` to check the board is honest). Never a side-file.
`;
}

/** The \`/vow-orchestrate\` skill — the in-session entry to run a LIVE fleet of vow agents through the host's
 *  workflow runtime (which renders live; a passive bash does not). Provider-neutral: the host gives the
 *  runtime + view, vow gives the substance. */
export function vowOrchestrateSkill(): string {
  return `---
name: vow-orchestrate
description: Run a LIVE fleet of vow agents — one per issue, developing through vow's gated loop, watchable. Use when the user wants several vow issues developed at once and wants to see it happen.
---

# Orchestrate a vow agent fleet (live)

The user wants several vow issues developed at once AND wants to watch it happen. In Claude Code, drive this through the host's **Workflow tool** — it renders a live view (\`/workflows\`: phases, agents, progress). A bash \`vow agent run-all\` is PASSIVE — the user sees nothing until it finishes — so it is NOT the in-session path.

## The workflow

Write a workflow that fans out one agent per issue. Each agent:

1. Reads its gated plan: \`vow agent plan <n>\` — the self-contained, verification-gated task (it already carries the issue's area specialist focus).
2. Develops it on a \`feat/issue-<n>\` branch / its own worktree, staying strictly in scope.
3. Verifies: \`vp check\` = 0 AND \`pnpm -r test\` = 0.
4. Opens a PR with \`Closes #<n>\`. Green → mergeable; red → a draft (surfaced, never auto-merged).

Return one line per issue (the PR + the verdict). The user watches every lane live via \`/workflows\`.

## Why through the host

vow owns the **substance** — the gated plan, the gates, the issues, the area specialists. The host owns the **runtime + the live view**. "Alles ueberall": in another host, another runtime. The work always lands back in vow's issues, never a side-file.

## Single issue / headless

One issue, no watching → \`vow agent run <n>\`. Headless / CI (no live view needed) → \`vow agent run-all <n>...\` (add \`--json\` to pipe the NDJSON to a UI).
`;
}

/** The \`/vow-audit\` skill — the in-session entry to run a LIVE multi-agent audit whose findings become vow
 *  ISSUES (the plan), not a side-file. The host workflow fans the audit out; vow gives the prompt + filing. */
export function vowAuditSkill(): string {
  return `---
name: vow-audit
description: Audit the codebase via a live fleet of agents — findings become vow issues (the plan), never a side-file. Use when the user wants a multi-agent audit of the code.
---

# Audit through vow (live)

The user wants a multi-agent audit whose findings become vow ISSUES (the plan), never a side-file. In Claude Code, drive it through the host's **Workflow tool** (live via \`/workflows\`).

## The workflow

Fan out one agent per dimension (correctness, security, performance, types, tests, docs, …). Each agent:

1. Gets its instruction: \`vow agent audit --prompt <dimension>\` — review read-only, output a JSON array of findings (\`{title, area, evidence, fix}\`).
2. Audits the codebase — it edits NOTHING.
3. Returns its findings JSON.

Collect every agent's findings into one \`findings.json\`, then file them: \`vow agent audit --file findings.json\` — each becomes a labelled, milestoned vow issue. The user watches every lane via \`/workflows\`.

## Why

The audit → plan flow is vow's own: findings ARE issues, never a \`.claude/plans\` side-file. The host gives the live runtime + view; vow gives the prompt, the filing, and the issues.
`;
}
