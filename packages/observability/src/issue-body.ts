/**
 * The issue-template bodies — pure builders that fill `.github/ISSUE_TEMPLATE/`'s sections so a
 * programmatically-opened issue PASSES the issue-template gate instead of tripping it. Split from the
 * gh-shelling in `github.ts` (which kept it over the max-lines line): a feature an agent proposes, and a bug
 * the audit files. Both lead with the essence and footer the strand + the live plan board.
 */

/** The default strand attribution for an agent-opened feature issue. */
const DEFAULT_STRAND = "generation · author layer";

/** The live plan board — vow's issues / Project ARE the plan, so a filed issue links back to it. */
export const PLAN_BOARD = "https://github.com/users/vndredev/projects/3";

/**
 * The feature-template body (fills `.github/ISSUE_TEMPLATE/feature.md`'s sections), so an issue the agent
 * opens passes the template gate. The element + why lead (the essence first); the strand attribution + a link
 * to the live plan board are a quiet footer. Pure.
 */
export function featureIssueBody(
  input: Readonly<{ element: string; strand?: string; why: string }>,
): string {
  const strand = input.strand ?? DEFAULT_STRAND;
  return [
    `**What**`,
    ``,
    input.element,
    ``,
    `**Why** — ${input.why}`,
    ``,
    `---`,
    `*Strand: ${strand} · [plan board](${PLAN_BOARD})*`,
    ``,
  ].join("\n");
}

/**
 * The bug-template body (fills `.github/ISSUE_TEMPLATE/bug.md`'s sections), so an audit-FILED bug passes the
 * issue-template gate AND reads as a bug, not a feature. The evidence leads (what happened); the proposed fix
 * is the relevant output; a quiet footer names the source + the plan board. Pure.
 */
export function bugIssueBody(input: Readonly<{ evidence: string; fix: string }>): string {
  return [
    `**What happened**`,
    ``,
    input.evidence,
    ``,
    `**Relevant output** — the proposed fix`,
    ``,
    input.fix,
    ``,
    `**Environment**: filed by vow's audit (the workflow auditor) · [plan board](${PLAN_BOARD})`,
    ``,
  ].join("\n");
}
