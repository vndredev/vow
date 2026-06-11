import type { GateResult, IssueSpec, TaskOutcome, VerifyResult } from "./types.ts";

/** "ok" / "failed" for a boolean — the run-report status words. */
function okText(ok: boolean): string {
  if (ok) {
    return "ok";
  }
  return "failed";
}

/** A gate's line in the run report — a pass/fail marker + the command it ran. */
function gateLine(gate: GateResult): string {
  if (gate.ok) {
    return `  ok   ${gate.command}`;
  }
  return `  FAIL ${gate.command}`;
}

/** The headline verdict — what the runner does next given the re-run gates. */
function verdictLine(verdict: VerifyResult): string {
  if (verdict.ok) {
    return "result: verified — the runner would merge";
  }
  return "result: a gate failed — the runner would open a draft";
}

/**
 * A report of a completed `vow agent run` — the provider's outcome, each re-run gate, and the verdict
 * (merge vs. draft). Pure (formats a `TaskOutcome`), so the runner's result is inspectable and the
 * formatting is unit-tested without spawning anything.
 */
export function runReport(issue: IssueSpec, outcome: TaskOutcome): string {
  const gates = outcome.verdict.results.map((gate) => gateLine(gate)).join("\n");
  return [
    `issue #${issue.number}: ${issue.title}`,
    `provider run: ${okText(outcome.run.ok)}`,
    `gates:`,
    gates,
    verdictLine(outcome.verdict),
  ].join("\n");
}
