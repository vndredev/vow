---
group: Fulfilment
order: 2
---

# proof — scenario-coverage

A vow's `## proves` are its contract: the scenarios that must hold. The **scenario-coverage gate** makes sure none goes unproven — every promised scenario must have a matching test, or the gate is red.

- For **`emit`**, vow derives the scenarios from the declaration and names the generated tests after them — they prove themselves.
- For **`bind`**, you write the scenario; vow expects a test whose name _is_ that scenario, and **you own the assertion** (see the honest limit below).

## How the gate runs

`runGate` does three things in one pass:

```
1. generate   →  .generated/ is fresh   (so generated tests exist — solves generate-before-test)
2. collect    →  every promised scenario across the vows  +  every test name in the corpus
3. check      →  a scenario with no matching test  →  uncovered  →  gate red
```

A claim is _covered_ only when a test's name **equals it exactly** — a substring match would let an empty claim ride on every test (and "adds a task" ride on "readds a task"). Anything else is an unproven promise.

::: warning The honest limit — naming-coverage, not behaviour
The gate scans test sources for `test("<name>")` strings; it never runs them. So it proves a test **named** after each claim exists, not that the test asserts anything. For **`emit`** that is enough — the same emitter writes both the claim and a real test body, in lock-step. For **`bind`** the body is hand-written, so a green name means "a test of this name exists", **not** "the bound behaviour is proven" — you still own writing a test that actually exercises the symbol. (`pnpm -r test` runs the bodies; the coverage gate only guarantees the test is there to run.)
:::

## Generated views prove themselves — render + a11y

Beyond the `emit entity` factory tests, a generated **view** proves itself at runtime. For each `## view` (and `## form`), vow generates a `<slug>.render.test.ts` that mounts the `.vue` in jsdom (`@vue/test-utils`) and runs **axe** on it — two derived scenarios, named so the coverage gate covers them:

- **`The <View> view renders`** — mounts the component (a broken template throws here)
- **`The <View> view has no accessibility violations`** — axe finds zero violations on the rendered DOM

A generated **form** proves one thing more — its **validation**:

- **`The <Form> form rejects an incomplete submit`** — mounts the form, submits it empty, and asserts a `role="alert"` error surfaces (the zod factory rejects the draft)

This closes a gap that lint, type-check, and the production build all miss: a generated `.vue` is only _trusted_ until it's actually mounted (the build tree-shakes unused code; unit tests run in Node). _Foundation:_ today it asserts the empty/default state; seeded data is a later step.

## Status is derived, never set

A vow is "proven" only when its scenarios are green — there is no hand-set status to drift. The gate is what makes a promise mean something: you cannot claim behaviour you haven't proven.

`deriveStatus` (`@vow/core`) reads a vow's status straight off this truth: `done` when every claim it promises is covered, `active` when some is, `planned` when none is yet — and a parent rolls its children up. So the [changelog](/guide/changelog) can derive itself rather than be hand-maintained (`blocked` joins once CI reports a failing test).
