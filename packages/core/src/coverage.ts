/**
 * Scenario-coverage — the gate that keeps a promise from going unproven.
 *
 * Every scenario a vow claims must have a test named EXACTLY that claim. The emitter names each
 * generated test after the claim (the test names ARE the proven scenarios), so `emit` vows cover
 * themselves; a `bind` vow's hand-written test must be named the claim verbatim. A claim with no
 * exact match — or an empty/blank claim — is an unproven promise → the gate is red. This also catches
 * a generated test that was never run (e.g. `.generated/` not built): its claim shows up uncovered.
 *
 * HONEST LIMIT: `testNames` are scanned, not executed, so this is NAMING-coverage, not behavioral-
 * coverage. A green claim means a test of that exact name EXISTS — not that it runs or asserts. For
 * `emit` vows the body ships with the name (lock-step), so the distinction is moot. For the hand-
 * written `bind` path it matters: an empty `test("<claim>", () => {})` would cover the claim here
 * without proving the bound behaviour. Naming-coverage is the gate; the real assertion is the
 * author's responsibility.
 */
export function uncoveredScenarios(
  expected: readonly string[],
  testNames: readonly string[],
): string[] {
  const names = new Set(testNames);
  /*
   * Exact match — a substring match let an empty claim ride on every test name, and "adds a task"
   * ride on "readds a task quickly" (both false-greens). A blank claim can never be covered.
   */
  return expected.filter((claim) => claim.trim() === "" || !names.has(claim));
}
