import { execFileSync } from "node:child_process";
import commitTypes from "./commit-types.json" with { type: "json" };

/**
 * @vow/observability — read the truth into a derived timeline. Today it reads **git** (the merged
 * history, day 1 → now); coverage + CI join next (so a vow's derived status can include `blocked`).
 * This is what lets the roadmap derive itself instead of being hand-maintained.
 */

/** A Badge variant — vow's status colours (see @vow/theme). */
export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

/**
 * The single source for the commit vocabulary: every conventional-commit `type` → its timeline Badge
 * variant (`commit-types.json`). The commit-msg hook (`commitlint.config.js`) enforces a subject uses one
 * of these keys, and the roadmap timeline colours each change by it — so the format the git hook
 * guarantees is the format the timeline reads, from one definition.
 */
export const COMMIT_TYPES: Readonly<Record<string, string>> = commitTypes;

const VARIANTS = new Set<string>(["neutral", "accent", "success", "warning", "danger"]);

/** The Badge variant for a commit type — `neutral` for an unknown type or an unrecognised value. */
export function variantForType(type: string | undefined): BadgeVariant {
  const v = type === undefined ? undefined : COMMIT_TYPES[type];
  return v !== undefined && VARIANTS.has(v) ? (v as BadgeVariant) : "neutral";
}

/** One point on the timeline — a merged change, by date, with its conventional-commit type and (when
    squashed `(#N)`) its PR number. */
export interface TimelineEntry {
  readonly date: string; // YYYY-MM-DD
  readonly title: string; // the subject, conventional-commit `type(scope):` prefix stripped
  readonly type?: string; // the conventional-commit type (feat · fix · docs · …), when present
  readonly pr?: number; // the PR number, when the subject ends in "(#N)"
}

/** Parse `git log --first-parent --format=%ad%x09%s --date=short` output → timeline entries. The
    trailing `(#N)` of a squash-merge is lifted into `pr` and dropped from the title. Pure. */
export function parseGitLog(output: string): TimelineEntry[] {
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): TimelineEntry => {
      const tab = line.indexOf("\t");
      const date = tab === -1 ? "" : line.slice(0, tab);
      const raw = tab === -1 ? line : line.slice(tab + 1);
      const pm = /\s*\(#(\d+)\)\s*$/.exec(raw);
      const subject = pm === null ? raw : raw.slice(0, pm.index).trim();
      const cc = /^(\w+)(?:\([\w-]+\))?: (.+)$/.exec(subject); // type(scope): description
      return {
        date,
        title: cc?.[2] ?? subject,
        ...(cc?.[1] !== undefined ? { type: cc[1] } : {}),
        ...(pm?.[1] !== undefined ? { pr: Number(pm[1]) } : {}),
      };
    });
}

/** The repo's GitHub base URL (e.g. `https://github.com/owner/repo`) from `origin`, for PR links. */
export function gitRemoteUrl(cwd: string): string | undefined {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf8",
    }).trim();
    const m = /github\.com[:/](.+?)(?:\.git)?$/.exec(url); // git@…:owner/repo.git | https://…/owner/repo
    return m === null ? undefined : `https://github.com/${m[1]}`;
  } catch {
    return undefined;
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
      ["log", "--first-parent", ref, "--format=%ad%x09%s", "--date=short"],
      { cwd, encoding: "utf8" },
    );
    return parseGitLog(out);
  } catch {
    return [];
  }
}
