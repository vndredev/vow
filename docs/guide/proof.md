# proof — scenario-coverage

A vow's `## proves` are its contract: the scenarios that must hold. The **scenario-coverage gate** makes sure none goes unproven — every promised scenario must have a matching test, or the gate is red.

- For **`emit`**, vow derives the scenarios from the declaration and names the generated tests after them — they prove themselves.
- For **`bind`**, you write the scenario; vow expects a test whose name _is_ that scenario.

## How the gate runs

`runGate` does three things in one pass:

```
1. generate   →  .generated/ is fresh   (so generated tests exist — solves generate-before-test)
2. collect    →  every promised scenario across the forest  +  every test name in the corpus
3. check      →  a scenario with no matching test  →  uncovered  →  gate red
```

A claim that contains a test of the same name is _covered_; anything else is an unproven promise.

## Status is derived, never set

A vow is "proven" only when its scenarios are green — there is no hand-set status to drift. The gate is what makes a promise mean something: you cannot claim behaviour you haven't proven.
