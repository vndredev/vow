import type { TaskOutcome, TaskRequest } from "./types.ts";
import { branchFor, buildPlan } from "./plan.ts";
import { dispatch } from "./dispatch.ts";
import { verify } from "./verify.ts";

/**
 * One full loop over an issue: set up an isolated worktree, build the gated plan + dispatch the provider in
 * it, re-run the gates there, and ALWAYS tear the worktree down. The whole agent loop as a single call —
 * provider-neutral, every effect injected via `request.ops`, tested end-to-end without claude or git. The
 * worktree spans dispatch + verify (verify must see the agent's changes), so its lifecycle lives here.
 */
export async function runTask(request: TaskRequest): Promise<TaskOutcome> {
  const { context, cwd, issue, ops, provider } = request;
  const task = {
    branch: branchFor(issue),
    cwd,
    plan: buildPlan(issue, context),
    title: issue.title,
  };
  await ops.worktreeAdd(cwd, task.branch);
  try {
    const run = await dispatch(task, provider, ops);
    const verdict = await verify(context.verify, cwd, async (command, dir) => {
      const result = await ops.run({ args: ["-c", command], bin: "sh" }, dir);
      return result.code;
    });
    return { run, verdict };
  } finally {
    await ops.worktreeRemove(cwd);
  }
}
