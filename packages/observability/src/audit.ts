import type { CreateIssueInput } from "./github.ts";
import type { Maybe } from "./types.ts";
import { bugIssueBody } from "./issue-body.ts";

/** The `area:` labels the repo actually carries. `gh issue create` does NOT auto-create a label, so an
 *  area outside this set (cli, store, agent, ...) would make the create exit non-zero and drop the
 *  finding — `auditIssue` attaches the `area:` label only when the area is one of these. */
const KNOWN_AREAS: ReadonlySet<string> = new Set([
  "core",
  "docs",
  "dx",
  "emit",
  "gate",
  "github",
  "mcp",
  "primitives",
  "studio",
]);

/** A confirmed audit finding — what the multi-agent audit emits, ready to become a vow issue: the title,
 *  the evidence (the why), the fix (the element to build), and an optional `area` (the `area:` label). */
export interface Finding {
  readonly area: string;
  readonly evidence: string;
  readonly fix: string;
  readonly title: string;
}

/** The milestone fragment for a resolved `phase` — present only when a phase exists (a milestone-less repo
 *  files bare, and `phaselessIssues` then surfaces it). Keeps `exactOptionalPropertyTypes` happy. */
function phaseMilestone(phase: Maybe<string>): { readonly milestone?: string } {
  if (typeof phase === "string" && phase !== "") {
    return { milestone: phase };
  }
  return {};
}

/** Map a confirmed finding to a `gh issue create` input — the audit → plan step, so a finding lands in
 *  vow's plan as a labelled, phased issue and never a side file. It is stamped with the resolved current
 *  `phase` (the caller resolves it once), so an audit finding never drifts in phase-less — the same
 *  invariant `add_issue` enforces. The `area:` label is attached only for a known area (see `KNOWN_AREAS`);
 *  an unknown / empty area files without it (`gh` would otherwise reject the unknown label and drop the
 *  whole finding) — the title + phase still land. Pure (the phase is passed in). */
export function auditIssue(finding: Readonly<Finding>, phase: Maybe<string>): CreateIssueInput {
  const body = bugIssueBody({ evidence: finding.evidence, fix: finding.fix });
  const labels = ["bug"];
  if (KNOWN_AREAS.has(finding.area)) {
    labels.push(`area: ${finding.area}`);
  }
  return { body, labels, title: finding.title, ...phaseMilestone(phase) };
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
