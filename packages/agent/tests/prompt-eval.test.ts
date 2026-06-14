/**
 * Eval harness — pressure-tests the agent prompts the way a spec tests code:
 * NO PROMPT WITHOUT A FAILING TEST FIRST. Each test pins one invariant the
 * discipline must hold under adversarial reasoning. A rationalization that has
 * no counter-argument in the prompt can fire without resistance; naming it
 * closes it. These tests are the specification; the prompts are the tested artifact.
 */

import { DEFAULT_DEVELOP_PROMPT, DEFAULT_PLAN_PROMPT } from "../src/prompts.ts";
import { PREAMBLE, TEAM, WALL } from "../src/team.ts";
import { expect, test } from "vite-plus/test";

// ── Rationalization table ─────────────────────────────────────────────────────
// An agent will reach for one of these excuses when the rule feels inconvenient.
// Each must be named and closed in the wall so the agent sees the counter-argument
// Before acting, not after failing a gate.

test("the wall closes the 'simpler' rationalization — the ternary ban is unconditional, not context-weighted", () => {
  // An agent rationalises: "a ternary is simpler/cleaner in this one case."
  // The wall must say that simplicity is not an exemption — not just that the ban exists.
  expect(WALL).toContain("simpler");
});

test("the wall carries a named rationalization table — known excuses closed, not just rules listed", () => {
  // A list of rules (no-ternary, no-as) tells the agent WHAT is banned;
  // A rationalization table tells it WHY its planned escape fails. Both are needed.
  expect(WALL.toLowerCase()).toContain("rationalization");
});

// ── Letter = Spirit clause ────────────────────────────────────────────────────
// Without this, an agent reads "the intent is X" and decides its interpretation
// Of X overrides the explicit rule — the classic letter-vs-spirit escape hatch.

test("the wall carries the 'letter equals spirit' clause — the rule IS the intent, no override", () => {
  // Both words must appear so the clause is unambiguous. The agent must see that
  // Finding a rationalization means finding a bug in its reasoning, not an exception.
  expect(WALL).toContain("letter");
  expect(WALL).toContain("spirit");
});

// ── Red-Flags STOP list ───────────────────────────────────────────────────────
// A rule name tells the agent what to avoid; a Red-Flag names the MOMENT before
// The forbidden action fires, so the agent stops before writing the violation.

test("the develop prompt carries a Red-Flags STOP list — actions that must halt before they happen", () => {
  expect(DEFAULT_DEVELOP_PROMPT).toContain("Red flag");
});

test("the develop prompt's Red-Flags list covers scope creep — touching an out-of-scope file is a STOP", () => {
  expect(DEFAULT_DEVELOP_PROMPT).toContain("out of scope");
});

// ── Existing guarantees — must not regress ────────────────────────────────────

test("the plan template's STOP conditions pin the stale-commit and out-of-scope patterns", () => {
  // Two concrete triggers in the plan's STOP conditions block must not regress —
  // They are the canonical machine-checkable reasons to stop and report.
  expect(DEFAULT_PLAN_PROMPT).toContain("no longer matches HEAD");
  expect(DEFAULT_PLAN_PROMPT).toContain("outside the task");
});

test("every team agent's complete brief carries the wall — the rationalization table reaches every dispatch", () => {
  // Once WALL has the table, every brief carries it — PREAMBLE + WALL + agent.prompt.
  for (const agent of TEAM) {
    const brief = [PREAMBLE, "", WALL, "", agent.prompt].join("\n");
    expect(brief.toLowerCase()).toContain("rationalization");
  }
});
