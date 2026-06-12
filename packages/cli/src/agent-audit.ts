import { AUDIT_MODEL, auditCommand, childEnv, renderAuditPrompt } from "@vow/agent";
import { auditIssue, createIssue, parseFindings } from "@vow/observability";
// oxlint-disable-next-line no-duplicate-imports -- the agent-run value import elsewhere; Auth is a type
import type { Auth } from "./agent-run.ts";
import { execFileSync } from "node:child_process";
import { readPrompt } from "./agent-prompts.ts";

/**
 * The audit half of `vow agent auto` — when the backlog empties, run a full read-only audit pass so the
 * loop generates its own next work (the self-healing spiral). Each dimension is a headless `claude` audit
 * at the audit model; its findings are parsed (`parseFindings`) and filed as labelled, milestoned vow
 * issues (`auditIssue` + `createIssue`) — the audit -> plan step, never a side-file. The pure pieces
 * (`auditCommand`, `parseFindings`, `auditIssue`) are tested; this is the thin shell + file glue.
 */

/** The dimensions a full audit pass sweeps — every angle the multi-agent audit covers, run one at a time so
 *  each finding carries its dimension's area. A pass that files zero across all of them is findings-free. */
export const AUDIT_DIMENSIONS: readonly string[] = [
  "correctness",
  "types",
  "security",
  "performance",
  "architecture",
];

/** Shell one headless `claude` audit of `dimension` at the audit model, read-only, with the API key stripped
 *  for subscription auth (unless `--auth api`). Returns the raw stdout (a JSON findings array), or `[]` when
 *  the shell-out fails — a transient audit error must not crash the loop. */
function runDimensionAudit(dimension: string, auth: Auth, cwd: string): string {
  const prompt = renderAuditPrompt(readPrompt(cwd, "audit"), dimension);
  const command = auditCommand(AUDIT_MODEL, prompt, auth);
  try {
    return execFileSync(command.bin, [...command.args], {
      cwd,
      encoding: "utf8",
      // oxlint-disable-next-line no-process-env -- the parent env to hand (key-stripped) to the audit child
      env: childEnv(process.env, command.unsetEnv),
    });
  } catch {
    return "[]";
  }
}

/** File every finding `dimension` reported as a labelled, milestoned vow issue, and return how many were
 *  filed — so the pass can detect a clean (zero-finding) sweep. */
function fileDimension(dimension: string, auth: Auth, cwd: string): number {
  const findings = parseFindings(runDimensionAudit(dimension, auth, cwd));
  for (const finding of findings) {
    process.stdout.write(`${createIssue(cwd, auditIssue(finding))}\n`);
  }
  return findings.length;
}

/** Run a full audit pass across every dimension, filing each finding as a vow issue; returns the TOTAL
 *  filed. The auto-loop sets `auditedClean = true` for the next round only when this is 0 (a findings-free
 *  sweep), so the next decision powers down (`done`). Any findings re-fill the backlog for the next round. */
export function runAuditPass(auth: Auth, cwd: string): number {
  process.stdout.write("auto: backlog empty — auditing for new work\n");
  let filed = 0;
  for (const dimension of AUDIT_DIMENSIONS) {
    process.stdout.write(`auto: auditing ${dimension}\n`);
    filed += fileDimension(dimension, auth, cwd);
  }
  process.stdout.write(`auto: audit filed ${filed} issue(s)\n`);
  return filed;
}
