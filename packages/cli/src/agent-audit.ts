import {
  AUDIT_MODEL,
  DEFAULT_DEEP_AUDIT_PROMPT,
  auditCommand,
  childEnv,
  renderAuditPrompt,
  renderDeepAuditPrompt,
} from "@vow/agent";
/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import {
  type Maybe,
  auditIssue,
  createIssue,
  parseFindings,
  resolveCurrentPhase,
} from "@vow/observability";
/* oxlint-enable consistent-type-specifier-style */
import { existsSync, readdirSync } from "node:fs";
// oxlint-disable-next-line no-duplicate-imports -- the agent-run value import elsewhere; Auth is a type
import type { Auth } from "./agent-run.ts";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { readPrompt } from "./agent-prompts.ts";

/**
 * The audit half of `vow agent auto` — when the backlog empties, run a full read-only audit pass so the
 * loop generates its own next work (the self-healing spiral). Each dimension is a headless `claude` audit
 * at the audit model; its findings are parsed (`parseFindings`) and filed as labelled, milestoned vow
 * issues (`auditIssue` + `createIssue`) — the audit -> plan step, never a side-file. The pure pieces
 * (`auditCommand`, `parseFindings`, `auditIssue`) are tested; this is the thin shell + file glue.
 */

/** The dimensions a full audit pass sweeps — every angle the multi-agent audit covers, run one at a time so
 *  each finding carries its dimension's area. A pass that files zero across all of them is findings-free.
 *  `docs/drift` is the docs-specific dimension: code ↔ docs consistency, internal doc consistency, dead
 *  references, stale examples — semantic drift the mechanical gates can't see. */
export const AUDIT_DIMENSIONS: readonly string[] = [
  "correctness",
  "types",
  "security",
  "performance",
  "architecture",
  "docs/drift",
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

/** A pass's shared context — the auth, the cwd, and the phase every filed finding is stamped with
 *  (resolved once per pass, so the audit → plan step never re-resolves it per dimension). */
interface AuditContext {
  readonly auth: Auth;
  readonly cwd: string;
  readonly phase: Maybe<string>;
}

/** Run + file one dimension's audit. A broken shell-out files nothing and flags `broke`; a genuine empty
 *  array files nothing with `broke=false` (a real findings-free dimension). */
function fileDimension(dimension: string, context: AuditContext): DimensionResult {
  const { auth, cwd, phase } = context;
  const run = runDimensionAudit(dimension, auth, cwd);
  if (!run.ran) {
    process.stdout.write(`auto: ${dimension} audit failed — pass is broken, not findings-free\n`);
    return { broke: true, filed: 0 };
  }
  const findings = parseFindings(run.raw);
  for (const finding of findings) {
    process.stdout.write(`${createIssue(cwd, auditIssue(finding, phase))}\n`);
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
/** Audit + file every dimension under one context, summing the filed count and OR-ing the broke flag. */
function fileAll(context: AuditContext): AuditPassResult {
  let filed = 0;
  let broke = false;
  for (const dimension of AUDIT_DIMENSIONS) {
    process.stdout.write(`auto: auditing ${dimension}\n`);
    const result = fileDimension(dimension, context);
    filed += result.filed;
    broke ||= result.broke;
  }
  return { broke, filed };
}

export function runAuditPass(auth: Auth, cwd: string): AuditPassResult {
  process.stdout.write("auto: backlog empty — auditing for new work\n");
  const context: AuditContext = { auth, cwd, phase: resolveCurrentPhase(cwd) };
  const result = fileAll(context);
  process.stdout.write(`auto: audit filed ${result.filed} issue(s)\n`);
  return result;
}

/** Discover the slices for a deep audit: every directory under `packages/` (one per package) and the
 *  top-level `docs/` directory. Each slice is an absolute path the per-slice claude invocation runs in.
 *  A missing `packages/` or `docs/` is silently skipped — the completeness-critic flags entirely-missed
 *  slices; an absent directory is simply not a slice. */
function discoverSlices(cwd: string): readonly string[] {
  const slices: string[] = [];
  const packagesDir = path.join(cwd, "packages");
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        slices.push(path.join(packagesDir, entry.name));
      }
    }
  }
  const docsDir = path.join(cwd, "docs");
  if (existsSync(docsDir)) {
    slices.push(docsDir);
  }
  return slices;
}

/** Shell one headless `claude` audit of `dimension` for `slice` at the audit model, using the deep audit
 *  prompt (scoped to the slice, exhaustive file coverage). The `cwd` of the spawn is the slice directory
 *  so the model's relative Glob/Read calls are naturally scoped to that package. */
function runSliceAudit(dimension: string, slice: string, context: AuditContext): AuditRun {
  const { auth, cwd } = context;
  const sliceName = path.relative(cwd, slice);
  const prompt = renderDeepAuditPrompt(DEFAULT_DEEP_AUDIT_PROMPT, dimension, sliceName);
  const command = auditCommand(AUDIT_MODEL, prompt, auth);
  try {
    const out = execFileSync(command.bin, [...command.args], {
      cwd: slice,
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

/** Run + file one (dimension × slice) audit. A broken shell-out files nothing and flags `broke`; a genuine
 *  empty array files nothing with `broke=false` (a real findings-free result for that slice). */
function fileSliceDimension(
  dimension: string,
  slice: string,
  context: AuditContext,
): DimensionResult {
  const { cwd, phase } = context;
  const run = runSliceAudit(dimension, slice, context);
  if (!run.ran) {
    const sliceName = path.relative(cwd, slice);
    process.stdout.write(
      `auto: ${dimension}@${sliceName} audit failed — pass is broken, not findings-free\n`,
    );
    return { broke: true, filed: 0 };
  }
  const findings = parseFindings(run.raw);
  for (const finding of findings) {
    process.stdout.write(`${createIssue(cwd, auditIssue(finding, phase))}\n`);
  }
  return { broke: false, filed: findings.length };
}

/** Per-slice totals from `sweepSlices` — the broke flag, total findings, and per-slice broken-dimension
 *  counts for the completeness-critic (a count equal to AUDIT_DIMENSIONS.length means the slice was missed). */
interface SliceSweepResult {
  readonly broke: boolean;
  readonly filed: number;
  readonly breaksBySlice: Map<string, number>;
}

/** Audit all dimensions for one slice, logging each, and return the count of broken dimensions + filed count. */
function sweepDimensions(slice: string, context: AuditContext): { broke: number; filed: number } {
  let filed = 0;
  let broke = 0;
  const sliceName = path.relative(context.cwd, slice);
  for (const dimension of AUDIT_DIMENSIONS) {
    process.stdout.write(`auto: auditing ${dimension}@${sliceName}\n`);
    const result = fileSliceDimension(dimension, slice, context);
    filed += result.filed;
    if (result.broke) {
      broke += 1;
    }
  }
  return { broke, filed };
}

/** Run `sweepDimensions` for every slice, accumulating the filed count and per-slice break counts. */
function sweepSlices(slices: readonly string[], context: AuditContext): SliceSweepResult {
  let filed = 0;
  let broke = false;
  const breaksBySlice = new Map<string, number>();
  for (const slice of slices) {
    const dims = sweepDimensions(slice, context);
    filed += dims.filed;
    if (dims.broke > 0) {
      broke = true;
    }
    breaksBySlice.set(slice, dims.broke);
  }
  return { breaksBySlice, broke, filed };
}

/** Run a deep audit pass — an exhaustive, HEAD-independent sweep of every package slice and `docs/` across
 *  ALL dimensions (including `docs/drift`). Unlike `runAuditPass` (one claude per dimension for the WHOLE
 *  codebase), the deep pass partitions the codebase into slices and gives each slice its own claude per
 *  dimension, so the model reads EVERY file in each slice with no sampling. A completeness-critic step runs
 *  after all slices: any slice where EVERY dimension broke (entirely missed) is flagged — the pass can never
 *  read as findings-free if a slice was never actually audited. */
export function runDeepAuditPass(auth: Auth, cwd: string): AuditPassResult {
  process.stdout.write("auto: deep audit — sweeping every package + docs/ slice by slice\n");
  const context: AuditContext = { auth, cwd, phase: resolveCurrentPhase(cwd) };
  const slices = discoverSlices(cwd);
  process.stdout.write(`auto: ${slices.length} slice(s) to audit\n`);
  const sweep = sweepSlices(slices, context);
  const missed = slices
    .filter((slice) => sweep.breaksBySlice.get(slice) === AUDIT_DIMENSIONS.length)
    .map((slice) => path.relative(cwd, slice));
  if (missed.length > 0) {
    process.stdout.write(
      `auto: completeness-critic: ${missed.length} slice(s) entirely missed — ${missed.join(", ")}\n`,
    );
  }
  process.stdout.write(
    `auto: deep audit filed ${sweep.filed} issue(s) across ${slices.length} slice(s)\n`,
  );
  return { broke: sweep.broke || missed.length > 0, filed: sweep.filed };
}
