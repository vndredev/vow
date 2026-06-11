import type { AgentTask, TaskOutcome, TaskRequest, VerifyResult } from "./types.ts";
import { branchFor, buildPlan } from "./plan.ts";
import {
  commitArgs,
  prBody,
  prCreateArgs,
  prTitle,
  pushArgs,
  stageArgs,
  verify,
} from "./verify.ts";
import { dispatch, gateCommand, worktreePath } from "./dispatch.ts";
import { modelFor } from "./model.ts";

/** Publish the developed task — stage + commit the agent's work, push the branch, open the PR (a draft
 *  when the gates aren't all green). Runs before the worktree is torn down, so the work persists as a PR. */
async function publish(
  task: AgentTask,
  verdict: VerifyResult,
  request: TaskRequest,
): Promise<void> {
  const { issue, ops } = request;
  const at = task.cwd;
  const title = prTitle(issue);
  const body = `Closes #${issue.number}\n\n${prBody(task.plan, verdict)}`;
  await ops.run({ args: stageArgs(), bin: "git" }, at);
  await ops.run({ args: commitArgs(title), bin: "git" }, at);
  await ops.run({ args: pushArgs(task.branch), bin: "git" }, at);
  await ops.run({ args: prCreateArgs(title, body, verdict.ok), bin: "gh" }, at);
}

/** Develop the task inside its worktree — dispatch the provider, re-run the gates, and publish a
 *  successful run as a PR. The worktree's setup + teardown stay in `runTask`. */
async function develop(request: TaskRequest, task: AgentTask): Promise<TaskOutcome> {
  const { context, ops, provider } = request;
  const run = await dispatch(task, provider, ops);
  const verdict = await verify(context.verify, task.cwd, async (command, dir) => {
    const result = await ops.run(gateCommand(command), dir);
    return result.code;
  });
  if (run.ok) {
    await publish(task, verdict, request);
  }
  return { run, verdict };
}

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
    return await develop(request, task);
  } finally {
    await ops.worktreeRemove(worktree);
  }
}
