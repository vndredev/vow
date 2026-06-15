---
name: vow-brainstorm
description: Turn a vague idea into an approved .vow.md spec (or issue) via Socratic dialogue — one question at a time. HARD GATE — no implementation until the user explicitly approves. Use when a user has an idea and needs to shape it into a concrete spec before the loop picks it up.
---

# Brainstorm → spec (Socratic front-door)

The user has a vague idea. Ask ONE clarifying question at a time, build a shared understanding, then write the spec. **No files written, no code generated, no issue opened until the user explicitly approves the draft** — that is the hard gate.

## The loop

1. **Receive** — the user states their idea in any form (a sentence, a goal, a problem, a use case).
2. **Ask one question** — the single most important unknown right now. One question, not a list.
3. **Listen and update** — the answer shapes the next question. Ask again when a gap remains.
4. **Repeat** until you can write a complete, honest spec (typically 3–7 rounds).
5. **Draft** — write the full `.vow.md` AND the issue title + body inline in the chat. Show both.
6. **Wait for explicit approval** — the user says "yes", "looks good", "ship it", or equivalent. Silence, a question, or a correction is NOT approval — keep iterating.
7. **Only after approval**: write the spec to `app/<slug>.vow.md` and open the issue via `gh issue create`.

## What a good question looks like

- Targets the single biggest unknown: scope, user, key output, constraint, or data shape.
- Is answerable in one or two sentences.
- Does NOT presuppose an implementation ("should it be a modal?" is premature — leave the design open).
- Builds toward the right `fulfills:` directive (`emit entity`, `emit view`, or `emit form`).

## The spec format

```markdown
---
id: vow_<slug>
fulfills: <emit entity | emit view | emit form>
---

# <one-line human description>

## fields

- <name>: <type>[, required]
```

Slug rules: lowercase letters only, exactly one underscore (`vow_task`, never `vow_invoice_total`). The `id:` slug lives IN the filename (`app/vow_task.vow.md` — slug = filename stem). The `fulfills:` line is the emit directive; fields list the data the spec owns.

## The issue

Title: `feat: <description>` (lowercase, imperative). Body follows the PR-template shape — **Summary** (one sentence), **What** (the element), **Proof** (how to verify it works), **Next** (follow-on work). File it after approval only: `gh issue create --title "feat: …" --body "…"`. The issue IS the plan — never a side-file.

## What NOT to do

- Do NOT write any file or run any command before the user approves the draft.
- Do NOT ask multiple questions in one message.
- Do NOT restate the idea as a list — ask the question.
- Do NOT treat silence or a follow-up question as approval.
- Do NOT hardcode implementation choices the spec should leave open.
