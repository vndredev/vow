import type { IssueSpec, Provider } from "./types.ts";
import { branchFor } from "./plan.ts";

/** The placeholder shown in place of the inlined plan (which `vow agent plan <n>` prints in full). */
const PLAN_ELIDED = "<plan>";

/**
 * A preview of what `vow agent run <n>` would do for `issue` via `provider` — the branch, the provider
 * command (the inlined plan elided), and the verification gates — without spawning anything. Pure, so the
 * runner's intent is inspectable before a single process starts.
 */
export function dryRunReport(issue: IssueSpec, provider: Provider): string {
  const branch = branchFor(issue);
  const { args, bin } = provider.command({
    branch,
    cwd: ".",
    plan: PLAN_ELIDED,
    title: issue.title,
  });
  return [
    `issue:    #${issue.number} ${issue.title}`,
    `provider: ${provider.name}`,
    `branch:   ${branch}`,
    `command:  ${bin} ${args.join(" ")}`,
    `gates:    vp check · pnpm -r test`,
    `(dry run — nothing executed; \`vow agent plan ${issue.number}\` prints the inlined plan)`,
  ].join("\n");
}
