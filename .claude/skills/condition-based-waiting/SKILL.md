---
name: condition-based-waiting
description: Poll the observable condition, never a fixed delay. Use when waiting for CI, a server, a build, or any external process — whenever you are about to write a sleep or a fixed delay.
---

# Condition-based waiting

Poll the condition that defines "ready". A fixed sleep is wrong twice: too short and it flaps; too long and it wastes time. Both hide information.

In vow:

- CI: `gh pr checks <n> --watch` — streams status lines; exits 0 when green, non-zero when red.
- Server or build: `until <check>; do sleep 2; done` — poll the port or the output file.
- Gates: `vp lint` / `pnpm -r test` — run them; they block until done.

Never: `sleep 30` as a guess, a retry loop without a condition, or a fixed delay before a gate.

When tempted to sleep: name the observable condition ("the port is open", "CI is green") and poll THAT.
