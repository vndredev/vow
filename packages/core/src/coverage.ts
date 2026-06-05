/**
 * scenario-coverage — the gate that keeps a promise from going unproven.
 *
 * Every scenario a vow claims must have a matching test in the corpus. A claim is "covered" when
 * some test name contains it — the emitter names each generated test after the claim, so `emit`
 * vows cover themselves; a `bind` vow's hand-written test must carry the claim as its name. Any
 * uncovered claim is an unproven promise → the gate is red. This also catches a generated test that
 * was never run (e.g. `.generated/` not built): its claim simply shows up uncovered.
 */
export function uncoveredScenarios(
  expected: readonly string[],
  testNames: readonly string[],
): string[] {
  return expected.filter((claim) => !testNames.some((name) => name.includes(claim)));
}
