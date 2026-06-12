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

/** Whether `raw` parses to a JSON array — the shape a real audit emits. A non-array payload (claude erroring
 *  into prose, an empty stdout) is a BROKEN audit, not zero findings. */
function isJsonArray(raw: string): boolean {
  try {
    return Array.isArray(JSON.parse(raw));
  } catch {
    return false;
  }
}

/** One dimension's shell-out result — a discriminated union (no sentinel): `ran` carries the raw findings
 *  array stdout; the broken case carries no payload. A broken audit (the shell-out threw, or returned a
 *  non-array) must NOT be folded to zero findings — that would read as findings-free and power the loop down
 *  having checked nothing — so it is its OWN case, never a genuine `[]`. */
type AuditRun = { readonly ran: false } | { readonly raw: string; readonly ran: true };

/** Shell one headless `claude` audit of `dimension` at the audit model, read-only, with the API key stripped
 *  for subscription auth (unless `--auth api`). `ran:true` (with the raw stdout) when the audit ran AND
 *  emitted a JSON array; `ran:false` when it FAILED — the shell-out threw (no `claude` on PATH, a dead
 *  subscription, a transient error) OR returned a payload that is not a JSON array. */
function runDimensionAudit(dimension: string, auth: Auth, cwd: string): AuditRun {
  const prompt = renderAuditPrompt(readPrompt(cwd, "audit"), dimension);
  const command = auditCommand(AUDIT_MODEL, prompt, auth);
  try {
    const out = execFileSync(command.bin, [...command.args], {
      cwd,
      encoding: "utf8",
      // oxlint-disable-next-line no-process-env -- the parent env to hand (key-stripped) to the audit child
      env: childEnv(process.env, command.unsetEnv),
    });
    if (isJsonArray(out)) {
      return { ran: true, raw: out };
    }
    return { ran: false };
  } catch {
    return { ran: false };
  }
}

/** The outcome of one dimension's audit — the findings filed, and whether the dimension's shell-out BROKE
 *  (threw or returned a non-array). A broken dimension must keep the pass from reading findings-free. */
interface DimensionResult {
  readonly broke: boolean;
  readonly filed: number;
}

/** Run + file one dimension's audit. A broken shell-out files nothing and flags `broke`; a genuine empty
 *  array files nothing with `broke=false` (a real findings-free dimension). */
function fileDimension(dimension: string, auth: Auth, cwd: string): DimensionResult {
  const run = runDimensionAudit(dimension, auth, cwd);
  if (!run.ran) {
    process.stdout.write(`auto: ${dimension} audit failed — pass is broken, not findings-free\n`);
    return { broke: true, filed: 0 };
  }
  const findings = parseFindings(run.raw);
  for (const finding of findings) {
    process.stdout.write(`${createIssue(cwd, auditIssue(finding))}\n`);
  }
  return { broke: false, filed: findings.length };
}

/** The result of a full audit pass — the TOTAL findings filed across every dimension, and whether ANY
 *  dimension's shell-out broke. The auto-loop powers down (`done`) only on a pass that filed zero AND did not
 *  break; a broken pass must terminate the loop non-zero, never read as findings-free. */
export interface AuditPassResult {
  readonly broke: boolean;
  readonly filed: number;
}

/** Run a full audit pass across every dimension, filing each finding as a vow issue. A pass is CLEAN only
 *  when every dimension's shell-out succeeded and filed zero (`broke=false, filed=0`); any broken dimension
 *  marks the whole pass broken so the loop can stop loudly rather than declare success having audited nothing.
 *  Any findings re-fill the backlog for the next round. */
export function runAuditPass(auth: Auth, cwd: string): AuditPassResult {
  process.stdout.write("auto: backlog empty — auditing for new work\n");
  let filed = 0;
  let broke = false;
  for (const dimension of AUDIT_DIMENSIONS) {
    process.stdout.write(`auto: auditing ${dimension}\n`);
    const result = fileDimension(dimension, auth, cwd);
    filed += result.filed;
    broke ||= result.broke;
  }
  process.stdout.write(`auto: audit filed ${filed} issue(s)\n`);
  return { broke, filed };
}
