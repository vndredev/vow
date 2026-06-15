---
name: verification-before-completion
description: Run the gates and include the evidence before claiming done. Use when you are about to write "done", "fixed", or "this should work" — the evidence must be in the same message, not a follow-up.
---

# Verify before claiming done

Never claim a task complete without fresh, machine-checked evidence in THIS message.

1. Run `vp lint` — confirm exit 0.
2. Run `pnpm -r test` — confirm 0 failures.
3. Only after both pass: write "done" / "fixed" with the gate output as proof.

If a gate fails: stop, fix the failure, re-run, then report. "It should work" is not evidence. The gates are machine-checkable — never self-judge them.
