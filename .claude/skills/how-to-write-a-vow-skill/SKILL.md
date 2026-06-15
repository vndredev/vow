---
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

The `description` field fires as the agent's context-matching signal. Write it as "Use when <observable condition>". Never describe WHAT the skill does — that is the body's job. A description that summarises the procedure becomes a drifting copy of the body and defeats the trigger.

## The body

- Ordered steps when sequence matters; bullets when not.
- Concrete: name the command, the gate, the vow path.
- No prose explaining philosophy — state the technique.
- End with the machine-checkable test that confirms the technique worked.

## Registering the skill

Add the skill as an entry in the `SKILLS` array in `packages/agent/src/skills.ts`. `vow agent init` scaffolds it from there — edit the source, not the generated file. File an issue, develop it through the red line, and it travels with every `vow agent init` that follows.

## When to promote to a gate

If the technique is a rule every change must follow (not just some), promote it to a mechanical CI gate. A skill the agent must choose to consult is weaker than a gate CI runs on every push.
