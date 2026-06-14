import { expect, test } from "vite-plus/test";
import { prBodyProblems, prBodyScaffold } from "../src/pr-body.ts";

// The template has four required sections, so a body that fills none reports four problems.
const ALL_SECTIONS = 4;

// The issue number used in scaffold tests.
const SCAFFOLD_ISSUE = 649;

// The number of Proof checkboxes the scaffold pre-fills.
const PROOF_CHECKBOXES = 3;

// Whether any reported problem names the given section.
function flags(problems: readonly string[], section: string): boolean {
  return problems.some((problem) => problem.includes(section));
}

// A genuinely-filled body — every section carries real content.
const FILLED = `## Summary

Enforce the filled PR-template body as a CI gate.

## What

- Add \`prBodyProblems\` to @vow/observability.
- Add the \`pr-body.yml\` workflow.

## Proof

- [x] \`vp check\` green
- [x] \`pnpm -r test\` green
- [ ] doc updated 1:1

## Next

—

Closes #398
`;

// The anti-pattern the gate exists to catch: a PR that skips the template entirely.
const BARE = "Closes #398\n";

// The template's own placeholder body — headings + HTML-comment hints + the bare \`-\`, nothing filled.
const PLACEHOLDER = `<!-- Keep it small — one element per PR. -->

## Summary

<!-- One line: what this delivers. -->

## What

<!-- The concrete changes, as bullets. -->

-

## Proof

- [ ] \`vp check\` green
- [ ] \`pnpm -r test\` green
- [ ] the relevant **doc page** updated 1:1

## Next

<!-- Anything deliberately deferred — or "—". -->
`;

test("prBodyProblems: a filled body passes (no problems)", () => {
  expect(prBodyProblems(FILLED)).toEqual([]);
});

test("prBodyProblems: a bare `Closes #N` fails every section", () => {
  const problems = prBodyProblems(BARE);
  expect(problems.length).toBe(ALL_SECTIONS);
  expect(flags(problems, "Summary")).toBe(true);
  expect(flags(problems, "What")).toBe(true);
  expect(flags(problems, "Proof")).toBe(true);
  expect(flags(problems, "Next")).toBe(true);
});

test("prBodyProblems: the unfilled template (comments + bare `-`) fails", () => {
  const problems = prBodyProblems(PLACEHOLDER);
  // Summary, What, and Next are placeholder-only; Proof's checkboxes are present, so it is not flagged.
  expect(flags(problems, "Summary")).toBe(true);
  expect(flags(problems, "What")).toBe(true);
  expect(flags(problems, "Next")).toBe(true);
  expect(flags(problems, "Proof")).toBe(false);
});

test("prBodyProblems: an empty body fails", () => {
  expect(prBodyProblems("").length).toBe(ALL_SECTIONS);
});

test("prBodyProblems: a `## What` of only the bare `-` placeholder fails What", () => {
  const onlyBareBullet = FILLED.replace(
    "- Add `prBodyProblems` to @vow/observability.\n- Add the `pr-body.yml` workflow.",
    "-",
  );
  expect(flags(prBodyProblems(onlyBareBullet), "What")).toBe(true);
});

test("prBodyScaffold: includes the issue title in Summary and the Closes link", () => {
  const body = prBodyScaffold(SCAFFOLD_ISSUE, "scaffold the PR body from the issue");
  expect(body).toContain("## Summary");
  expect(body).toContain("scaffold the PR body from the issue");
  expect(body).toContain(`Closes #${SCAFFOLD_ISSUE}`);
});

test("prBodyScaffold: pre-fills all three Proof checkboxes", () => {
  const body = prBodyScaffold(SCAFFOLD_ISSUE, "scaffold the PR body from the issue");
  expect(body.match(/- \[ \]/gu)?.length).toBe(PROOF_CHECKBOXES);
});

test("prBodyScaffold: fails --check only on What — agent must supply the bullets", () => {
  const body = prBodyScaffold(SCAFFOLD_ISSUE, "scaffold the PR body from the issue");
  const problems = prBodyProblems(body);
  expect(problems.length).toBe(1);
  expect(flags(problems, "What")).toBe(true);
});

test("prBodyScaffold: passes --check once the What bullets are filled", () => {
  const body = prBodyScaffold(SCAFFOLD_ISSUE, "scaffold the PR body from the issue").replace(
    "\n-\n",
    "\n- Add `prBodyScaffold` to @vow/observability.\n",
  );
  expect(prBodyProblems(body)).toEqual([]);
});
