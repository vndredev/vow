import type { TaskOutcome, TaskRequest } from "./types.ts";
import { branchFor, buildPlan } from "./plan.ts";
import { dispatch, gateCommand, worktreePath } from "./dispatch.ts";
import { modelFor } from "./model.ts";
import { verify } from "./verify.ts";

/**
 * One full loop over an issue: set up an isolated worktree (a path distinct from the repo, under
 * `.vow-worktrees/`), build the gated plan + dispatch the provider in it, re-run the gates there, and
 * ALWAYS tear the worktree down. The whole agent loop as a single call — provider-neutral, every effect
 * injected via `request.ops`, tested end-to-end without claude or git. The worktree spans dispatch +
 * verify (verify must see the agent's changes), so its lifecycle lives here.
 */
export async function runTask(request: TaskRequest): Promise<TaskOutcome> {
  const { context, cwd, issue, ops, provider } = request;
  const branch = branchFor(issue);
  // A path distinct from the repo root — so `git worktree add` succeeds and the run is isolated; `cwd`
  // (the repo) only seeds that path.
  const worktree = worktreePath(cwd, branch);
  const task = {
    branch,
    cwd: worktree,
    // The runner develops the gated plan — the EXECUTE role, so a cheaper model suffices (drift-proof).
    model: modelFor(provider.models, "execute"),
    plan: buildPlan(issue, context),
    title: issue.title,
  };
  await ops.worktreeAdd(worktree, branch);
  try {
    const run = await dispatch(task, provider, ops);
    const verdict = await verify(context.verify, worktree, async (command, dir) => {
      const result = await ops.run(gateCommand(command), dir);
      return result.code;
    });
    return { run, verdict };
  } finally {
    await ops.worktreeRemove(worktree);
  }
}
