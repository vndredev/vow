---
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
