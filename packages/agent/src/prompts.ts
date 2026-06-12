/**
 * The operative agent PROMPTS as editable, provider-neutral templates — vow's agent behaviour is the prompt,
 * so the prompt is a versioned repo artifact, not a string baked into the binary. ONE source of truth per
 * role lives here as the canonical DEFAULT; `vow agent init` scaffolds each into the provider folder
 * (`.claude/prompts/<role>.md` for the Claude-Code layout) and the run READS the scaffolded file, falling
 * back to this default when it is absent. The reach differs per role: `audit.md` + `plan.md` drive the NATIVE
 * run (the auto-loop's audit pass reads `audit.md`; the live run builds its gated plan from `plan.md`), while
 * `develop.md` drives the in-session `/vow-develop` skill (the native executor mechanizes the develop steps,
 * so it consumes the plan, not develop.md). So editing `.claude/prompts/audit.md` changes the audit pass
 * without touching vow's source — and a test pins that init writes exactly what the reader returns (a seam
 * that can't lie). The placeholders (`{dimension}`, `{title}`, …) are filled at read time, so the template
 * stays editable while the run still substitutes the live facts.
 */

/** The agent roles whose operative prompt is a scaffolded template — the develop instruction the executor
 *  runs, the audit instruction a read-only pass runs, and the plan skeleton a run is built from. */
export type PromptRole = "audit" | "develop" | "plan";

/** The default AUDIT prompt — the read-only audit instruction for one `{dimension}` (the reader substitutes
 *  the live dimension). Output is ONLY a JSON findings array, the shape the filer ingests; the audit edits
 *  nothing (findings become vow issues — the audit -> plan step). Edit `.claude/prompts/audit.md` to tune it. */
export const DEFAULT_AUDIT_PROMPT = `Audit this codebase for {dimension}. Report only real, evidenced problems — no speculation.

Output ONLY a JSON array (no prose). Each element is a finding with these string fields:
- title: a concise issue title
- area: the vow area (emit, gate, studio, docs, core), or empty
- evidence: the proof — file:line + what is wrong
- fix: the change to make

An empty array [] when nothing is found. Do NOT edit any file — this audit is read-only.`;

/** The default DEVELOP prompt — the operative develop instruction the IN-SESSION `/vow-develop` skill follows
 *  (read AGENTS.md, branch, keep it one coherent element, verify both gates, open a PR, merge green / draft
 *  red). The NATIVE `vow agent run` executor does NOT read this — it mechanizes branch/PR/merge in `loop.ts`
 *  and runs the gated PLAN (built from `plan.md`); develop.md is the in-session flow's steady guidance. Edit
 *  `.claude/prompts/develop.md` to tune that flow. */
export const DEFAULT_DEVELOP_PROMPT = `Develop the issue through vow's red line — read AGENTS.md first; it is the contract.

1. Branch \`<type>/<slug>\` off main (feat/fix/docs/…), never main.
2. Make the change; keep it ONE coherent element, strictly in scope.
3. Verify: \`vp check\` exits 0 AND \`pnpm -r test\` has 0 failures. Fix until both are green.
4. Open a PR with \`Closes #<n>\`, filling the template (Summary / What / Proof / Next).
5. When CI's gate is green, merge; a red run becomes a draft — never merge off a red gate.

The plan is the GitHub issues — never a side-file. Stay strictly in the task's scope.`;

/** The default PLAN prompt — the self-contained, verification-gated plan SKELETON an autonomous run is built
 *  from. The placeholders (`{title}`, `{number}`, `{commit}`, `{focus}`, `{body}`, `{gates}`) are filled at
 *  read time, so the structure stays editable while the run substitutes the live issue + gates. `{focus}`
 *  expands to a `## Focus` block or nothing. Edit `.claude/prompts/plan.md` to tune the discipline. */
export const DEFAULT_PLAN_PROMPT = `# Plan: {title} (#{number})

Written against commit \`{commit}\`. Verify HEAD still matches before you start; if it has moved, re-read the changed files or STOP.

{focus}## The task
{body}

## Verification gates
Run each; every one must pass. These are machine-checkable — never judge success yourself.
{gates}

## Out of scope
- Anything not named in "The task". Do not refactor, rename, or touch adjacent code.

## STOP conditions — stop and report, never improvise
- A verification command fails in a way the task did not anticipate.
- The commit stamp above no longer matches HEAD (the plan is stale).
- The change would touch a file outside the task's scope.`;

/** The canonical default for each role — the ONE source of truth `init` writes and the reader falls back to.
 *  Keyed by role so the scaffold + the reader can't drift (the same map drives both). */
const DEFAULT_PROMPTS: Readonly<Record<PromptRole, string>> = {
  audit: DEFAULT_AUDIT_PROMPT,
  develop: DEFAULT_DEVELOP_PROMPT,
  plan: DEFAULT_PLAN_PROMPT,
};

/** The canonical default prompt for `role` — the built-in fallback when no scaffolded file is present, and
 *  exactly what `vow agent init` writes for that role (the seam the sync test pins). Pure. */
export function defaultPrompt(role: PromptRole): string {
  return DEFAULT_PROMPTS[role];
}

/** Substitute every `{key}` placeholder in `template` from `values` — the seam that lets a scaffolded prompt
 *  (or the default) be filled with the run's live facts at read time. An unknown placeholder is left as-is
 *  (the template owns its vocabulary; an unrecognized brace is the user's literal text). Pure. */
export function fillPrompt(template: string, values: Readonly<Record<string, string>>): string {
  return template.replaceAll(/\{(\w+)\}/gu, (whole, key: string) => values[key] ?? whole);
}

/** Render an AUDIT prompt for `dimension` from `template` (the scaffolded `audit.md`, or the default) — fills
 *  the `{dimension}` placeholder. The instruction's body is the editable template; the dimension is live. */
export function renderAuditPrompt(template: string, dimension: string): string {
  return fillPrompt(template, { dimension });
}

/** One scaffolded prompt template — its role, the provider-relative path `init` writes it to, and the
 *  canonical default content. The list below is the single thing `init` iterates. */
export interface PromptTemplate {
  readonly content: string;
  readonly path: string;
  readonly role: PromptRole;
}

/** The provider folder the Claude-Code layout scaffolds prompts into — sibling to the skills, so a user edits
 *  the prompt where they already find the agent's other artifacts. A different provider renders a different
 *  layout over the SAME content (the role + the default), not a different prompt. */
export const CLAUDE_PROMPTS_DIR: readonly string[] = [".claude", "prompts"];

/** The role order `init` scaffolds — fixed so the report + the sync test read deterministically. */
export const PROMPT_ROLES: readonly PromptRole[] = ["develop", "audit", "plan"];

/** The provider-relative path for `role`'s scaffolded prompt under the Claude-Code layout
 *  (`.claude/prompts/<role>.md`). Joined with "/" so it is OS-neutral as a manifest entry; the caller
 *  resolves it under the repo root. */
export function promptRelPath(role: PromptRole): string {
  return [...CLAUDE_PROMPTS_DIR, `${role}.md`].join("/");
}

/** Every prompt template `vow agent init` scaffolds — the role, its provider-relative path, and the canonical
 *  default content. Derived from `defaultPrompt` so the scaffold can never carry a stale copy of a default
 *  (ONE source of truth). The reader (`readPrompt`) loads the same path and falls back to the same default. */
export function promptTemplates(): readonly PromptTemplate[] {
  return PROMPT_ROLES.map((role) => ({
    content: defaultPrompt(role),
    path: promptRelPath(role),
    role,
  }));
}
