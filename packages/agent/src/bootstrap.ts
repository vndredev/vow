/**
 * The `using-vow` session bootstrap — the load-bearing router a SessionStart hook force-feeds into EVERY
 * agent session (startup, /clear, compact). vow has the team (who) + the gates (the law), but a fresh
 * headless session knows neither until it trips a gate and rediscovers the rule by failing. This text is the
 * TRIGGER: injected as the session's first context, it makes vow's red line, gates, and team auto-fire — a
 * mechanism, not a plea in a file the next session's model never reads (90% mechanics, 10% LLM).
 *
 * The content is OWNED here (one source of truth) and stays a tight, honest summary of AGENTS.md — no
 * overselling (the docs-honesty bar). It is PROVIDER-NEUTRAL: a pure string, no harness shape and no provider
 * name. Each harness wraps it in its own envelope at the seam (`sessionStartOutput` in `hook.ts` for Claude
 * Code); a second harness is a new adapter over this same text, never a rewrite.
 */

/** The header + THE RULE: consult a vow discipline/skill BEFORE acting (even before clarifying questions). */
const RULE_SECTION: readonly string[] = [
  "# Using vow",
  "",
  "This repo is **vow** — a spec-driven, LLM-first generator, developed THROUGH itself on one gated red",
  "line. Read AGENTS.md for the full contract; this is the always-loaded router.",
  "",
  "## THE RULE (read before acting)",
  "",
  "If there is even a small chance a vow discipline or skill applies, CONSULT it BEFORE acting — including",
  "before asking clarifying questions. The disciplines below are not optional knowledge; they fire first.",
];

/** The red line — the gated sequence every change runs, in order. */
const RED_LINE_SECTION: readonly string[] = [
  "## The red line (every change runs it, in order)",
  "",
  "1. **Plan** — the work is an issue (the plan lives in GitHub / the studio, never a side-file).",
  "2. **Branch** — `<type>/<slug>` (feat/fix/docs/...), never `main`. main is PR-only, no admin bypass.",
  "3. **Develop** — in an isolated worktree, ONE coherent element (no scope creep, no gold-plating).",
  "4. **Verify** — `vp lint` = 0 AND `pnpm -r test` = 0. Machine-checkable; never judge it yourself.",
  "5. **Document** — every package has a row in `docs/guide/packages.md`; every element a doc page.",
  "6. **PR** — fill the template (Summary / What / Proof / Next); link the issue with `Closes #N`.",
  "7. **Merge** — the agent merges when CI's `gate` is green; a red run becomes a draft, never a merge.",
];

/** The gates that mechanically BLOCK drift — named, so the session knows the law before it trips one. */
const GATES_SECTION: readonly string[] = [
  "## The gates that BLOCK drift (mechanical law, not pleas)",
  "",
  "- **quality wall** — `vp lint` = 0 (oxlint -D all + strict tsgo): no `as`/`any`/`!`, no ternary, no",
  "  negated condition, no bare `undefined`. Fix a type hole at its source, never widen to silence it.",
  "- **framework-neutrality** — emitters describe UI in the neutral component model; a concrete framework",
  "  (Vue/React/Svelte) is named only behind its adapter seam.",
  "- **provider-neutrality** — a provider CLI bin is named ONLY at the provider seam; the loop names none.",
  "- **design-language coverage** — every emitted `vow-*` class has a rule in vow.css; no bespoke value.",
  "- **layer-DAG / no-cycle / max-lines** — the package graph is a clean DAG; the index is the only entry.",
  "- **has-a-doc / docs-drift** — the docs stay 1:1 with reality, honest, no overselling.",
  "- **pr-title (commitlint) / pr-body / branch-protection** — a lowercase `feat:` title, the filled",
  "  template, main protected. A gate failure fails the build; that is the point.",
];

/** The team of owners + the skill library — who does the work and where the techniques live. */
const TEAM_SECTION: readonly string[] = [
  "## The team + the skills",
  "",
  "An elite team of owners lives in `.claude/agents/` — the **vow-developer** builder carries any issue",
  "end-to-end, and one guardian owns each area paired with its gate (layer-architect, type-sentinel,",
  "security-auditor, framework-neutrality-guard, provider-neutrality-guard, coverage-keeper, docs-keeper,",
  "perf-auditor, a11y-keeper, design-language-keeper, studio-dx). The vow-develop / vow-orchestrate /",
  "vow-audit skills drive the loop. Dispatch the owner whose area the work touches.",
  "",
  "As the engineering-discipline techniques the team shares are written down, they live in the vow",
  "skill library — consult it for the technique before improvising one.",
];

/** The one principle behind every gate — everything flows through vow, nothing around it. */
const PRINCIPLE_SECTION: readonly string[] = [
  "## The principle",
  "",
  "Everything flows through vow (issues, the agent loop, vow's own workflows), nothing around it. Reaching",
  "for a side-file or an ad-hoc parallel IS the drift vow exists to prevent.",
];

/** The `using-vow` bootstrap text — the mandatory router every session reads first. A single source: the CLI
    prints it, the harness adapter wraps it, a test pins its load-bearing lines. Pure (no IO, no provider). */
export function sessionBootstrap(): string {
  return [
    ...RULE_SECTION,
    "",
    ...RED_LINE_SECTION,
    "",
    ...GATES_SECTION,
    "",
    ...TEAM_SECTION,
    "",
    ...PRINCIPLE_SECTION,
  ].join("\n");
}
