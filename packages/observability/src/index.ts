import { execFileSync } from "node:child_process";

/**
 * @vow/observability — read the truth into a derived timeline. Today it reads **git** (the merged
 * history, day 1 → now); coverage + CI join next (so a vow's derived status can include `blocked`).
 * This is what lets the roadmap derive itself instead of being hand-maintained.
 */

/** One point on the timeline — a merged change, by date, with its PR number when squashed `(#N)`. */
export interface TimelineEntry {
  readonly date: string; // YYYY-MM-DD
  readonly title: string; // the commit subject
  readonly pr?: number; // the PR number, when the subject ends in "(#N)"
}

/** Parse `git log --first-parent --format=%ad%x09%s --date=short` output → timeline entries. Pure. */
export function parseGitLog(output: string): TimelineEntry[] {
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const tab = line.indexOf("\t");
      const date = tab === -1 ? "" : line.slice(0, tab);
      const title = tab === -1 ? line : line.slice(tab + 1);
      const pr = /\(#(\d+)\)\s*$/.exec(title)?.[1];
      return pr === undefined ? { date, title } : { date, title, pr: Number(pr) };
    });
}

/**
 * The git timeline for a repo — the first-parent history (so each squashed PR is one entry), newest
 * first. Returns `[]` (never throws) when git or the repo is absent — so a build without git, or a
 * published package, just has no timeline rather than failing.
 */
export function gitTimeline(cwd: string): TimelineEntry[] {
  try {
    const out = execFileSync(
      "git",
      ["log", "--first-parent", "--format=%ad%x09%s", "--date=short"],
      { cwd, encoding: "utf8" },
    );
    return parseGitLog(out);
  } catch {
    return [];
  }
}
