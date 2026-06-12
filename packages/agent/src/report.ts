import type { GateResult, IssueSpec, TaskOutcome } from "./types.ts";

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

/** The headline result — what the runner does next. A failed provider run develops nothing, so the gate
 *  verdict (run on an unchanged worktree) is meaningless: no PR opens. Only a successful run reports the
 *  merge-vs-draft verdict. */
function resultLine(outcome: TaskOutcome): string {
  if (!outcome.run.ok) {
    return "result: the provider run failed — nothing developed, no PR opened";
  }
  if (outcome.verdict.ok) {
    return "result: verified — the runner would merge";
  }
  return "result: a gate failed — the runner would open a draft";
}

/** The failed provider run's captured output, indented under a `reason:` heading — so the terminal report
 *  carries WHY the run failed, not just "failed". Empty (no extra lines) for a successful run. */
function reasonLines(outcome: TaskOutcome): readonly string[] {
  const output = outcome.run.output.trim();
  if (outcome.run.ok || !output) {
    return [];
  }
  return ["reason:", ...output.split("\n").map((line) => `  ${line}`)];
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
    resultLine(outcome),
    ...reasonLines(outcome),
  ].join("\n");
}
