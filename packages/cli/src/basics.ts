import { APPS, repoRoot } from "./apps.ts";
import { checkToolCall, claudeDenyOutput, claudeToolCall } from "@vow/agent";
import { prBodyProblems } from "@vow/observability";
import process from "node:process";
import { spawnSync } from "node:child_process";

/** The PR template the body must match — the pointer `vow pr-body` prints on a failure. */
const PR_TEMPLATE = ".github/PULL_REQUEST_TEMPLATE.md";

/** Run a command from the repo root, inheriting stdio; return its exit code. */
function run(cmd: string, args: readonly string[]): number {
  return spawnSync(cmd, [...args], { cwd: repoRoot(), stdio: "inherit" }).status ?? 1;
}

/** `vow check [args]` → `vp check [args]` (fmt + lint + typecheck; forwards flags, e.g. `--fix`). */
export function check(args: readonly string[]): number {
  return run("vp", ["check", ...args]);
}

/** `vow build [app...]` → `vp build apps/<app>` for each (default: every app). Stops at the first failure. */
export function build(slugs: readonly string[]): number {
  let targets = slugs;
  if (targets.length === 0) {
    targets = APPS.map((app) => app.slug);
  }
  for (const slug of targets) {
    const code = run("vp", ["build", `apps/${slug}`]);
    if (code !== 0) {
      return code;
    }
  }
  return 0;
}

/** `vow test` → `pnpm -r test` (per-package, project-local bins) — NOT `vp test`, which can't resolve the
    project-local `jsdom` peer. Encoding the right command is the whole point of the wrapper. */
export function test(args: readonly string[]): number {
  return run("pnpm", ["-r", "test", ...args]);
}

/** The lines to print for a PR body's problems — a one-line OK, or each problem + the template pointer.
    Pure, so the verdict output is unit-testable. */
export function verdictLines(problems: readonly string[]): string[] {
  if (problems.length === 0) {
    return ["PR body matches the template."];
  }
  return [
    ...problems.map((problem) => `  ✗ ${problem}`),
    `Fill the PR template (${PR_TEMPLATE}) — Summary, What, Proof, Next.`,
  ];
}

/** Read all of stdin as a string — the PR body piped in for the pre-flight check. */
async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(String(chunk));
  }
  return chunks.join("");
}

/** `vow pr-body [--check]` — validate the PR body (piped on stdin) against the template BEFORE `gh pr
    create`, so a missing/empty section is caught LOCALLY, never first in CI. Runs the same `prBodyProblems`
    rule (`@vow/observability`) the CI gate runs — a green local check means a green gate. */
export async function prBody(): Promise<number> {
  const problems = prBodyProblems(await readStdin());
  for (const line of verdictLines(problems)) {
    process.stdout.write(`${line}\n`);
  }
  if (problems.length === 0) {
    return 0;
  }
  return 1;
}

/** Parse a hook payload; a malformed one defaults to `{}` so it guards as an allowed (empty) call. */
function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** `vow hook [provider]` — a provider's PreToolUse guardrail (Claude Code today; Codex / Gemini as further
    adapters over the same provider-neutral engine). Reads the hook payload on stdin, decides allow/deny via
    `checkToolCall`, and prints the provider's DENY JSON on a blocked call — nothing on allow, so the provider
    falls through to its normal permission flow. Always exits 0: the JSON, not the exit code, carries the
    decision (a non-zero exit would read as a hook ERROR, not a clean deny). */
export async function hook(): Promise<number> {
  const call = claudeToolCall(parsePayload(await readStdin()));
  const verdict = checkToolCall(call);
  if (verdict.decision === "deny") {
    process.stdout.write(`${JSON.stringify(claudeDenyOutput(verdict.reason))}\n`);
  }
  return 0;
}
