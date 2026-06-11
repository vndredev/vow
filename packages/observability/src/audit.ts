// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type CreateIssueInput, featureIssueBody } from "./github.ts";

/** The milestone an audit finding is filed under — vow's hardening phase. */
const AUDIT_MILESTONE = "Phase G — hardening (audit fixes)";

/** A confirmed audit finding — what the multi-agent audit emits, ready to become a vow issue: the title,
 *  the evidence (the why), the fix (the element to build), and an optional `area` (the `area:` label). */
export interface Finding {
  readonly area: string;
  readonly evidence: string;
  readonly fix: string;
  readonly title: string;
}

/** Map a confirmed finding to a `gh issue create` input — the audit → plan step, so a finding lands in
 *  vow's plan as a labelled, milestoned issue and never a side file. Pure. */
export function auditIssue(finding: Readonly<Finding>): CreateIssueInput {
  const body = featureIssueBody({ element: finding.fix, why: finding.evidence });
  if (finding.area === "") {
    return { body, milestone: AUDIT_MILESTONE, title: finding.title };
  }
  return { body, labels: [finding.area], milestone: AUDIT_MILESTONE, title: finding.title };
}

/** Whether a value is a non-null object — the entry to read an untrusted findings payload. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A string field off a record, or "" when absent / not a string. */
function field(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/** The raw array from a findings JSON payload, or `[]` when malformed / not an array. */
function findingsArray(json: string): readonly unknown[] {
  try {
    const raw: unknown = JSON.parse(json);
    if (Array.isArray(raw)) {
      return raw;
    }
  } catch {
    return [];
  }
  return [];
}

/** Parse a findings JSON array (the audit's `confirmed` output) into `Finding`s, skipping any malformed
    element (one lacking a title or a fix). Pure; `[]` on malformed input. */
export function parseFindings(json: string): Finding[] {
  const out: Finding[] = [];
  for (const item of findingsArray(json)) {
    if (isRecord(item) && field(item, "title") !== "" && field(item, "fix") !== "") {
      out.push({
        area: field(item, "area"),
        evidence: field(item, "evidence"),
        fix: field(item, "fix"),
        title: field(item, "title"),
      });
    }
  }
  return out;
}

/** The audit instruction for an agent — review the codebase for `dimension` and output ONLY a JSON array
 *  of findings (each `{title, area, evidence, fix}`, the shape `parseFindings` ingests). Read-only; the
 *  findings become vow issues (the audit -> plan step), never a side-file. */
export function auditPrompt(dimension: string): string {
  return [
    `Audit this codebase for ${dimension}. Report only real, evidenced problems — no speculation.`,
    "",
    "Output ONLY a JSON array (no prose). Each element is a finding with these string fields:",
    "- title: a concise issue title",
    "- area: the vow area (emit, gate, studio, docs, core), or empty",
    "- evidence: the proof — file:line + what is wrong",
    "- fix: the change to make",
    "",
    "An empty array [] when nothing is found. Do NOT edit any file — this audit is read-only.",
  ].join("\n");
}
