---
group: Fulfilment
order: 2
---

# proof — scenario-coverage

A vow's `## proves` are its contract: the scenarios that must hold. The **scenario-coverage gate** makes sure none goes unproven — every promised scenario must have a matching test, or the gate is red.

- For **`emit`**, vow derives the scenarios from the declaration and names the generated tests after them — they prove themselves.
- For **`bind`**, you write the scenario; vow expects a test whose name _is_ that scenario.

## How the gate runs

`runGate` does three things in one pass:

```
1. generate   →  .generated/ is fresh   (so generated tests exist — solves generate-before-test)
2. collect    →  every promised scenario across the vows  +  every test name in the corpus
3. check      →  a scenario with no matching test  →  uncovered  →  gate red
```

A claim is _covered_ when some test's name contains it; anything else is an unproven promise.

## Status is derived, never set

A vow is "proven" only when its scenarios are green — there is no hand-set status to drift. The gate is what makes a promise mean something: you cannot claim behaviour you haven't proven.

`deriveStatus` (`@vow/core`) reads a vow's status straight off this truth: `done` when every claim it promises is covered, `active` when some is, `planned` when none is yet — and a parent rolls its children up. So the [changelog](/guide/changelog) can derive itself rather than be hand-maintained (`blocked` joins once CI reports a failing test).
