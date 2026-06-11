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
