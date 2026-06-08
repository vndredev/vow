import { execFileSync } from "node:child_process";

/**
 * @vow/observability — read the truth into a derived timeline. Today it reads **git** (the merged
 * history, day 1 → now); coverage + CI join next (so a vow's derived status can include `blocked`).
 * This is what lets the roadmap derive itself instead of being hand-maintained.
 */

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
