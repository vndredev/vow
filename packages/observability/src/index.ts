import type { BadgeVariant, Maybe } from "./types.ts";
import { BADGE_VARIANTS } from "@vow/theme";
import { NONE } from "./none.ts";
import commitTypes from "./commit-types.json" with { type: "json" };
import { execFileSync } from "node:child_process";

/**
 * @vow/observability — read the truth into a derived timeline. Today it reads **git** (the merged
 * history, day 1 -> now); coverage + CI join next (so a vow's derived status can include `blocked`).
 * This is what lets the changelog derive itself instead of being hand-maintained.
 */

export type { BadgeVariant, Maybe } from "./types.ts";
export { NONE } from "./none.ts";

/**
 * The single source for the commit vocabulary: every conventional-commit `type` -> its timeline Badge
 * variant (`commit-types.json`). The commit-msg hook (`commitlint.config.js`) enforces a subject uses one
 * of these keys, and the changelog timeline colours each change by it — so the format the git hook
 * guarantees is the format the timeline reads, from one definition.
 */
export const COMMIT_TYPES: Readonly<Record<string, string>> = commitTypes;

/**
 * The conventional 72-column header budget — the single source for the commit-subject / PR-title length.
 * The commit-msg hook (`commitlint.config.js` `header-max-length`) enforces it, and the agent caps the PR
 * titles it authors to it, so the squash subject the agent writes is the subject the title-lint accepts.
 */
export const HEADER_MAX = 72;

const VARIANTS = new Set<string>(BADGE_VARIANTS);

/** Narrow a raw string to a `BadgeVariant` — a known colour, else `neutral`. */
function asVariant(value: string): BadgeVariant {
  switch (value) {
    case "accent": {
      return "accent";
    }
    case "success": {
      return "success";
    }
    case "warning": {
      return "warning";
    }
    case "danger": {
      return "danger";
    }
    default: {
      return "neutral";
    }
  }
}

/** The Badge variant for a commit type — `neutral` for an unknown type or an unrecognised value. */
export function variantForType(type: Maybe<string>): BadgeVariant {
  if (typeof type !== "string") {
    return "neutral";
  }
  const variant = COMMIT_TYPES[type];
  if (typeof variant !== "string" || !VARIANTS.has(variant)) {
    return "neutral";
  }
  return asVariant(variant);
}

/**
 * One point on the timeline — a merged change, by date, with its conventional-commit type and (when
 * squashed `(#N)`) its PR number.
 */
export interface TimelineEntry {
  // YYYY-MM-DD.
  readonly date: string;
  // The PR number, when the subject ends in "(#N)".
  readonly pr?: number;
  // The subject, conventional-commit `type(scope):` prefix stripped.
  readonly title: string;
  // The conventional-commit type (feat · fix · docs · …), when present.
  readonly type?: string;
  // The release tag this change shipped in (absent = Unreleased).
  readonly version?: string;
}

// The number of leading tab-separated columns (date, refs) before the raw subject.
const SUBJECT_COLUMN = 2;

const TAG_RE = /tag: (v[\w.-]+)/u;
const PR_RE = /\s*\(#(\d+)\)\s*$/u;
const CONVENTIONAL_RE = /^(\w+)(?:\([^)]+\))?!?: (.+)$/u;

/** The optional `version` carried while folding newest -> oldest, and an accumulator of entries. */
interface FoldState {
  readonly entries: readonly TimelineEntry[];
  readonly version: Maybe<string>;
}

/** The parsed pieces of one `git log` line, before they become a `TimelineEntry`. */
interface ParsedLine {
  readonly date: string;
  readonly pr: Maybe<string>;
  readonly subject: string;
  readonly type: Maybe<string>;
  readonly version: Maybe<string>;
}

// The capture-group index of the description inside `CONVENTIONAL_RE`.
const DESCRIPTION_GROUP = 2;

/** The release version a commit ships in: its own decorating tag, else the carried-down version. */
function resolveVersion(refs: string, carried: Maybe<string>): Maybe<string> {
  // A release tag decorating this commit becomes the version inherited by everything below it.
  const tagged = TAG_RE.exec(refs)?.[1];
  if (typeof tagged === "string") {
    return tagged;
  }
  return carried;
}

/** A raw subject split into its PR number (when squash-merged) and the subject minus that `(#N)`. */
interface SubjectPr {
  readonly pr: Maybe<string>;
  readonly subject: string;
}

/** Lift a trailing squash `(#N)` off a raw subject into `pr`, leaving the subject without it. */
function splitPr(raw: string): SubjectPr {
  const match = PR_RE.exec(raw);
  if (match === null) {
    return { pr: NONE, subject: raw };
  }
  return { pr: match[1], subject: raw.slice(0, match.index).trim() };
}

/** Split one `git log` line into its date, release version, conventional-commit type, PR and subject. */
function parseLine(line: string, carried: Maybe<string>): ParsedLine {
  const parts = line.split("\t");
  const raw = parts.slice(SUBJECT_COLUMN).join("\t");
  const { pr, subject } = splitPr(raw);
  // The conventional-commit prefix: type(scope)!: description (the `!` marks a breaking change).
  const cc = CONVENTIONAL_RE.exec(subject);
  return {
    date: parts[0] ?? "",
    pr,
    subject: cc?.[DESCRIPTION_GROUP] ?? subject,
    type: cc?.[1],
    version: resolveVersion(parts[1] ?? "", carried),
  };
}

/** The optional `type` field of a `TimelineEntry`, present only when the commit had one. */
function typeField(type: Maybe<string>): { type?: string } {
  if (typeof type === "string") {
    return { type };
  }
  return {};
}

/** The optional `pr` field of a `TimelineEntry`, parsed from the captured digits when present. */
function prField(pr: Maybe<string>): { pr?: number } {
  if (typeof pr === "string") {
    return { pr: Number(pr) };
  }
  return {};
}

/** The optional `version` field of a `TimelineEntry`, present only when a release tag was in scope. */
function versionField(version: Maybe<string>): { version?: string } {
  if (typeof version === "string") {
    return { version };
  }
  return {};
}

/** Build a `TimelineEntry` from a parsed line, omitting any absent optional. */
function toEntry(parsed: ParsedLine): TimelineEntry {
  return {
    date: parsed.date,
    title: parsed.subject,
    ...typeField(parsed.type),
    ...prField(parsed.pr),
    ...versionField(parsed.version),
  };
}

/** Fold one `git log` line into the running state — picking up a release tag, lifting the PR + type. */
function foldLine(state: FoldState, line: string): FoldState {
  const parsed = parseLine(line, state.version);
  return { entries: [...state.entries, toEntry(parsed)], version: parsed.version };
}

/**
 * Parse `git log --first-parent --format=%ad%x09%D%x09%s --date=short` output -> timeline entries.
 * The `%D` ref-decorations carry release tags (`tag: v0.0.1`); walking newest -> oldest, each commit
 * inherits the nearest release at/above it (`version`; absent = Unreleased). The trailing `(#N)` of a
 * squash-merge is lifted into `pr` and dropped from the title. Pure.
 */
export function parseGitLog(output: string): TimelineEntry[] {
  const lines = output.split("\n").filter((line) => line.trim() !== "");
  let state: FoldState = { entries: [], version: NONE };
  for (const line of lines) {
    state = foldLine(state, line);
  }
  return [...state.entries];
}

const GITHUB_REMOTE_RE = /github\.com[:/](.+?)(?:\.git)?$/u;

/** The repo's GitHub base URL (e.g. `https://github.com/owner/repo`) from `origin`, for PR links. */
export function gitRemoteUrl(cwd: string): Maybe<string> {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf8",
    }).trim();
    // Match either an SSH (git@…:owner/repo.git) or HTTPS (https://…/owner/repo) remote.
    const match = GITHUB_REMOTE_RE.exec(url);
    if (match === null) {
      return NONE;
    }
    return `https://github.com/${match[1]}`;
  } catch {
    return NONE;
  }
}

/** The short SHA of HEAD (`abc1234`), or `"unknown"` when git can't be read — the commit a plan is written
    against, so a stale plan (HEAD moved) can be caught before an executor touches anything. */
export function headCommit(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * The git timeline for a repo — the first-parent history of `ref` (default `main`, so only merged work
 * shows, never an in-flight feature branch), newest first; each squashed PR is one entry. Returns `[]`
 * (never throws) when git, the repo, or the ref is absent — so a build without git just has no timeline.
 */
export function gitTimeline(cwd: string, ref = "main"): TimelineEntry[] {
  try {
    const out = execFileSync(
      "git",
      ["log", "--first-parent", ref, "--format=%ad%x09%D%x09%s", "--date=short"],
      { cwd, encoding: "utf8" },
    );
    return parseGitLog(out);
  } catch {
    return [];
  }
}

// The GitHub side — issues, PRs, the derived issue plan, the Project sync, and the branch protection vow owns.
export * from "./audit.ts";
export * from "./ci.ts";
export * from "./events.ts";
export * from "./events-sse.ts";
export * from "./loop-status.ts";
export { prBodyProblems } from "./pr-body.ts";
export * from "./github.ts";
export * from "./issue-body.ts";
export * from "./phase.ts";
export * from "./project.ts";
export * from "./project-view.ts";
export * from "./protection.ts";
