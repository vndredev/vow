/**
 * The vow skill library — reusable engineering-discipline techniques the team agents + the loop consult.
 * Each skill is a TECHNIQUE: a composable HOW-TO with a WHEN-to-use trigger (the `description` field), never
 * a workflow summary the agent would follow instead of reading the body. `vow agent init` scaffolds each to
 * `.claude/skills/<name>/SKILL.md` (the Claude Code skill format) so every agent session auto-loads the
 * library. A new technique is one entry in `SKILLS`; the meta-skill (`how-to-write-a-vow-skill`) teaches the
 * pattern so the library self-extends. Where a technique is a rule EVERY change must follow, it is promoted
 * to a mechanical CI gate instead — a gate CI runs on every push is stronger than a skill an agent must choose
 * to consult.
 */

/** One engineering-discipline skill — its kebab-case name and its complete Markdown file content (YAML
 *  frontmatter + body). The frontmatter `description` is the WHEN-to-use trigger; the body is the technique. */
export interface Skill {
  readonly content: string;
  readonly name: string;
}

/** The engineering-discipline skills the vow team consult. Alphabetical by name so the scaffold order is
 *  deterministic and the test can pin the count without hard-coding a non-obvious sort. */
export const SKILLS: readonly Skill[] = [
  {
    content: `---
name: condition-based-waiting
description: Poll the observable condition, never a fixed delay. Use when waiting for CI, a server, a build, or any external process — whenever you are about to write a sleep or a fixed delay.
---

# Condition-based waiting

Poll the condition that defines "ready". A fixed sleep is wrong twice: too short and it flaps; too long and it wastes time. Both hide information.

In vow:
- CI: \`gh pr checks <n> --watch\` — streams status lines; exits 0 when green, non-zero when red.
- Server or build: \`until <check>; do sleep 2; done\` — poll the port or the output file.
- Gates: \`vp lint\` / \`pnpm -r test\` — run them; they block until done.

Never: \`sleep 30\` as a guess, a retry loop without a condition, or a fixed delay before a gate.

When tempted to sleep: name the observable condition ("the port is open", "CI is green") and poll THAT.
`,
    name: "condition-based-waiting",
  },
  {
    content: `---
name: defense-in-depth
description: Validate at every layer boundary. Use when data crosses a trust boundary — user input, HTTP body, DB row, MCP tool call, or parsed file — and whenever a gate catches an unsafe assumption.
---

# Defense in depth

Validate data at EVERY layer it passes through, not only the outermost one. A single-layer check leaves inner layers open when the outer is bypassed or the shape is wrong.

The boundaries in vow:
- HTTP (\`/__vow/*\`): validate the body before any DB write.
- MCP: validate tool-call args before any file or DB effect.
- DB: validate identifiers before interpolation (a raw slug in SQL is identifier-injection).
- Emitter: validate spec fields before emitting (an undefined in an HTML attribute is a bug).
- Parse: use a type predicate, not \`as\` — the gate flags the cast.

The fix is always AT the boundary (validate before use), not at the caller. A type hole is fixed with a real predicate at its source; the gate confirms it is gone.
`,
    name: "defense-in-depth",
  },
  {
    content: `---
name: how-to-write-a-vow-skill
description: Add a new technique to the skill library. Use when a reusable engineering technique is missing and you keep applying it ad hoc — codify it before the third time becomes a fourth.
---

# How to write a vow skill

A skill is a TECHNIQUE — a reusable HOW-TO the team applies repeatedly. It is not a workflow, a task description, or a list of steps to follow mechanically. The body teaches the technique; the agent applies judgement to the right moment.

## The format

A skill file is a Markdown file with YAML frontmatter:

    ---
    name: <slug>             # kebab-case
    description: <trigger>   # WHEN to use it (see below)
    ---

    # <Title>

    <The technique — structured, concrete, short.>

## The description is the trigger

The \`description\` field fires as the agent's context-matching signal. Write it as "Use when <observable condition>". Never describe WHAT the skill does — that is the body's job. A description that summarises the procedure becomes a drifting copy of the body and defeats the trigger.

## The body

- Ordered steps when sequence matters; bullets when not.
- Concrete: name the command, the gate, the vow path.
- No prose explaining philosophy — state the technique.
- End with the machine-checkable test that confirms the technique worked.

## Registering the skill

Add the skill as an entry in the \`SKILLS\` array in \`packages/agent/src/skills.ts\`. \`vow agent init\` scaffolds it from there — edit the source, not the generated file. File an issue, develop it through the red line, and it travels with every \`vow agent init\` that follows.

## When to promote to a gate

If the technique is a rule every change must follow (not just some), promote it to a mechanical CI gate. A skill the agent must choose to consult is weaker than a gate CI runs on every push.
`,
    name: "how-to-write-a-vow-skill",
  },
  {
    content: `---
name: systematic-debugging
description: Diagnose root cause before writing a fix. Use when a test fails, a lint rule fires, a command errors, or behaviour diverges from the spec — before touching any code.
---

# Systematic debugging

Identify the root cause before writing a fix. A patch at the symptom hides the real bug and leaves the next failure invisible.

1. Read the error in full. Name the file:line + the exact message.
2. Form one hypothesis — a specific, testable claim about WHY it fails.
3. Find evidence: read the relevant code or run the reproducing command.
4. If the evidence refutes the hypothesis: update it and repeat from step 3.
5. When confirmed: write the fix at the CAUSE, not the symptom. Validate with the gates.

Never change code before step 4. A "try this" patch without a confirmed hypothesis is noise that leaves the root cause alive.
`,
    name: "systematic-debugging",
  },
  {
    content: `---
name: test-first
description: Write the failing test before the implementation. Use when adding new behaviour, fixing a bug, or implementing a spec promise — any time you know what MUST be true before you know how to make it true.
---

# Test first

Write the test that pins the behaviour BEFORE writing the implementation. The test is the spec made executable; a test that starts green is not a test.

1. Name the test after what MUST be true — "renders the button label", "rejects a missing slug".
2. Write the test. Run it. Confirm it fails for the reason you expect (red first verifies the test is real).
3. Implement only enough to make it green. Nothing more.
4. Run \`vp lint\` + \`pnpm -r test\` — both must exit 0 before the next step.

The red-first step is the gate: if the test passes before your implementation, either the test is wrong or the behaviour already exists.
`,
    name: "test-first",
  },
  {
    content: `---
name: verification-before-completion
description: Run the gates and include the evidence before claiming done. Use when you are about to write "done", "fixed", or "this should work" — the evidence must be in the same message, not a follow-up.
---

# Verify before claiming done

Never claim a task complete without fresh, machine-checked evidence in THIS message.

1. Run \`vp lint\` — confirm exit 0.
2. Run \`pnpm -r test\` — confirm 0 failures.
3. Only after both pass: write "done" / "fixed" with the gate output as proof.

If a gate fails: stop, fix the failure, re-run, then report. "It should work" is not evidence. The gates are machine-checkable — never self-judge them.
`,
    name: "verification-before-completion",
  },
];

/** The provider-relative path for a skill under the Claude Code layout (`.claude/skills/<name>/SKILL.md`).
 *  Joined so the scaffold target can never drift from where `init` writes it. Pure. */
export function skillRelPath(name: string): string {
  return `.claude/skills/${name}/SKILL.md`;
}

/** The engineering-discipline skills as scaffold targets — `{ content, path }` per skill, the
 *  `.claude/skills/<name>/SKILL.md` files `vow agent init` writes (mirrors `teamTemplates()`). Pure. */
export function skillTemplates(): { readonly content: string; readonly path: string }[] {
  return SKILLS.map((skill) => ({
    content: skill.content,
    path: skillRelPath(skill.name),
  }));
}
