/**
 * Scenario-coverage — the gate that keeps a promise from going unproven.
 *
 * Every scenario a vow claims must have a test named EXACTLY that claim. The emitter names each
 * generated test after the claim (the test names ARE the proven scenarios), so `emit` vows cover
 * themselves; a `bind` vow's hand-written test must be named the claim verbatim. A claim with no
 * exact match — or an empty/blank claim — is an unproven promise → the gate is red. This also catches
 * a generated test that was never run (e.g. `.generated/` not built): its claim shows up uncovered.
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
