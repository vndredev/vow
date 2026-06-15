---
name: test-first
description: Write the failing test before the implementation. Use when adding new behaviour, fixing a bug, or implementing a spec promise — any time you know what MUST be true before you know how to make it true.
---

# Test first

Write the test that pins the behaviour BEFORE writing the implementation. The test is the spec made executable; a test that starts green is not a test.

1. Name the test after what MUST be true — "renders the button label", "rejects a missing slug".
2. Write the test. Run it. Confirm it fails for the reason you expect (red first verifies the test is real).
3. Implement only enough to make it green. Nothing more.
4. Run `vp lint` + `pnpm -r test` — both must exit 0 before the next step.

The red-first step is the gate: if the test passes before your implementation, either the test is wrong or the behaviour already exists.
