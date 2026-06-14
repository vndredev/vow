import { promptRelPath } from "@vow/agent";

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

/** The \`/vow-develop\` skill — a POINTER, not a copy: the operative develop instruction is the scaffolded
 *  \`.claude/prompts/develop.md\`, which THIS in-session skill reads + follows (the native \`vow agent run\`
 *  executor does NOT read develop.md — it mechanizes branch/PR/merge in \`loop.ts\` and consumes only the
 *  gated PLAN). So editing develop.md retunes the in-session develop flow. The path comes from
 *  \`promptRelPath\` so the skill can never drift from where \`init\` writes it. */
export function vowDevelopSkill(): string {
  const developPrompt = promptRelPath("develop");
  return `---
name: vow-develop
description: Develop an issue through vow's red line — branch, verify, PR, agent-merge. Use when picking up a vow issue.
---

# Develop through vow

Read \`AGENTS.md\` first — it is the contract. The OPERATIVE develop instruction lives in **\`${developPrompt}\`** — read that file and follow it; editing it retunes this in-session develop flow. If it is absent (a fresh repo, no \`vow agent init\`), the built-in default applies.

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
 *  ISSUES (the plan), not a side-file. The host workflow fans the audit out; the per-dimension instruction is
 *  NOT restated here — it is the scaffolded \`.claude/prompts/audit.md\` (the single source \`vow agent audit
 *  --prompt\` renders too), so editing that one file changes both the native path and this skill. */
export function vowAuditSkill(): string {
  const auditPrompt = promptRelPath("audit");
  return `---
name: vow-audit
description: Audit the codebase via a live fleet of agents — findings become vow issues (the plan), never a side-file. Use when the user wants a multi-agent audit of the code.
---

# Audit through vow (live)

The user wants a multi-agent audit whose findings become vow ISSUES (the plan), never a side-file. In Claude Code, drive it through the host's **Workflow tool** (live via \`/workflows\`).

## The workflow

Fan out one agent per dimension (correctness, security, performance, types, tests, docs, …). Each agent:

1. Gets its instruction from \`vow agent audit --prompt <dimension>\` — which renders the OPERATIVE audit prompt at **\`${auditPrompt}\`** (the single source of truth; the native agent reads it too, so editing that one file retunes every surface) with \`{dimension}\` filled. It defines the output: a JSON findings array. Don't restate it — read it.
2. Audits the codebase — it edits NOTHING.
3. Returns its findings JSON.

Collect every agent's findings into one \`findings.json\`, then file them: \`vow agent audit --file findings.json\` — each becomes a labelled, milestoned vow issue. The user watches every lane via \`/workflows\`.

## Why

The audit → plan flow is vow's own: findings ARE issues, never a \`.claude/plans\` side-file. The host gives the live runtime + view; vow gives the prompt, the filing, and the issues.
`;
}

const BRAINSTORM_SPEC_FORMAT = `\`\`\`markdown
---
id: vow_<slug>
fulfills: <emit entity | emit view | emit form>
---

# <one-line human description>

## fields

- <name>: <type>[, required]
\`\`\`

Slug rules: lowercase letters only, exactly one underscore (\`vow_task\`, never \`vow_invoice_total\`). The \`id:\` slug lives IN the filename (\`app/vow_task.vow.md\` — slug = filename stem). The \`fulfills:\` line is the emit directive; fields list the data the spec owns.`;

const BRAINSTORM_LOOP = `1. **Receive** — the user states their idea in any form (a sentence, a goal, a problem, a use case).
2. **Ask one question** — the single most important unknown right now. One question, not a list.
3. **Listen and update** — the answer shapes the next question. Ask again when a gap remains.
4. **Repeat** until you can write a complete, honest spec (typically 3–7 rounds).
5. **Draft** — write the full \`.vow.md\` AND the issue title + body inline in the chat. Show both.
6. **Wait for explicit approval** — the user says "yes", "looks good", "ship it", or equivalent. Silence, a question, or a correction is NOT approval — keep iterating.
7. **Only after approval**: write the spec to \`app/<slug>.vow.md\` and open the issue via \`gh issue create\`.`;

/** The `/vow-brainstorm` skill — the Socratic front-door that turns a vague idea into an approved spec
 *  before a single line of code is written. One question at a time, a hard gate before any file is
 *  written, output a \`.vow.md\` spec + a vow issue. Provider-neutral: the skill names the spec format
 *  and \`gh issue create\` — never a provider CLI. */
export function vowBrainstormSkill(): string {
  return `---
name: vow-brainstorm
description: Turn a vague idea into an approved .vow.md spec (or issue) via Socratic dialogue — one question at a time. HARD GATE — no implementation until the user explicitly approves. Use when a user has an idea and needs to shape it into a concrete spec before the loop picks it up.
---

# Brainstorm → spec (Socratic front-door)

The user has a vague idea. Ask ONE clarifying question at a time, build a shared understanding, then write the spec. **No files written, no code generated, no issue opened until the user explicitly approves the draft** — that is the hard gate.

## The loop

${BRAINSTORM_LOOP}

## What a good question looks like

- Targets the single biggest unknown: scope, user, key output, constraint, or data shape.
- Is answerable in one or two sentences.
- Does NOT presuppose an implementation ("should it be a modal?" is premature — leave the design open).
- Builds toward the right \`fulfills:\` directive (\`emit entity\`, \`emit view\`, or \`emit form\`).

## The spec format

${BRAINSTORM_SPEC_FORMAT}

## The issue

Title: \`feat: <description>\` (lowercase, imperative). Body follows the PR-template shape — **Summary** (one sentence), **What** (the element), **Proof** (how to verify it works), **Next** (follow-on work). File it after approval only: \`gh issue create --title "feat: …" --body "…"\`. The issue IS the plan — never a side-file.

## What NOT to do

- Do NOT write any file or run any command before the user approves the draft.
- Do NOT ask multiple questions in one message.
- Do NOT restate the idea as a list — ask the question.
- Do NOT treat silence or a follow-up question as approval.
- Do NOT hardcode implementation choices the spec should leave open.
`;
}
