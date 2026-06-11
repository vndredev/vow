/**
 * The verify + PR stage — after the agent develops a task, re-run its gates (the improve "review like a
 * tech lead": every done-criterion re-checked, not trusted) and open a PR. A run whose gates aren't all
 * green opens a DRAFT — surfaced for a human, never merged silently. The exec + git are injected, so the
 * stage is tested without running the gates or touching the network.
 */

import type { GateResult, VerifyResult } from "./types.ts";

/** Re-run each verification gate in `cwd`; the verdict is the conjunction. The exec is injected, so this
 *  is tested without running the gates. */
export async function verify(
  gates: readonly string[],
  cwd: string,
  run: (command: string, cwd: string) => Promise<number>,
): Promise<VerifyResult> {
  const results = await Promise.all(
    gates.map(
      async (command): Promise<GateResult> => ({ command, ok: (await run(command, cwd)) === 0 }),
    ),
  );
  return { ok: results.every((result) => result.ok), results };
}

/** A pass/fail mark for the PR body. */
function mark(ok: boolean): string {
  if (ok) {
    return "✓";
  }
  return "✗";
}

/** The `git push` args that publish the task's branch upstream. */
export function pushArgs(branch: string): readonly string[] {
  return ["push", "-u", "origin", branch];
}

/** The `gh pr create` args — title + body; a DRAFT when the gates didn't all pass (a red run is surfaced
 *  for a human, never mergeable). */
export function prCreateArgs(title: string, body: string, verified: boolean): readonly string[] {
  const base = ["pr", "create", "--title", title, "--body", body];
  if (verified) {
    return base;
  }
  return [...base, "--draft"];
}

/** The PR body: the gate verdict, then the plan the run was developed against. */
export function prBody(plan: string, verdict: VerifyResult): string {
  const gates = verdict.results
    .map((result) => `- ${mark(result.ok)} \`${result.command}\``)
    .join("\n");
  return [`## Verification ${mark(verdict.ok)}`, gates, "", "## Plan", plan].join("\n");
}
