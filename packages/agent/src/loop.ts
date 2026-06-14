import type { AgentOps, AgentTask, TaskOutcome, TaskRequest, VerifyResult } from "./types.ts";
import { branchFor, buildPlan } from "./plan.ts";
import {
  commitArgs,
  fixPrompt,
  prBody,
  prCreateArgs,
  prTitle,
  pushArgs,
  stageArgs,
  verify,
} from "./verify.ts";
import { dispatch, gateCommand, worktreePath } from "./dispatch.ts";
import { specFixPrompt, specReviewOnce } from "./review.ts";
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
  const body = prBody(issue, verdict);
  await ops.run({ args: stageArgs(), bin: "git" }, at);
  await ops.run({ args: commitArgs(title), bin: "git" }, at);
  await ops.run({ args: pushArgs(task.branch), bin: "git" }, at);
  await ops.run({ args: prCreateArgs(title, body, verdict.ok), bin: "gh" }, at);
}

/** Auto-format the worktree before the gate — `vp fmt` writes, so a whitespace/format deviation in the
 *  provider's output is corrected in place and can NEVER fail the verify gate (which then judges real
 *  defects, not layout). `publish` stages the result; best-effort — the verify gate is the judge, not
 *  fmt's exit. This is why a formatting issue can't draft an otherwise-green run. */
async function format(task: AgentTask, ops: AgentOps): Promise<void> {
  await ops.run(gateCommand("vp fmt"), task.cwd);
}

/** Publish a developed outcome as a PR — but only when the provider run itself succeeded (a failed run
 *  developed nothing to publish). Emits the `publish` phase before the work hits GitHub. */
async function publishOutcome(
  request: TaskRequest,
  task: AgentTask,
  outcome: TaskOutcome,
): Promise<void> {
  if (!outcome.run.ok) {
    return;
  }
  request.onPhase?.("publish");
  await publish(task, outcome.verdict, request);
}

/** Format the worktree, then re-run `gates` — the verdict for one attempt. Shared by the first develop pass,
 *  each fix round (the FAST `context.verify`), and the final pre-PR pass (the thorough `context.finalVerify`),
 *  so every gate pass format-then-gates identically; only the gate SET differs. */
async function gateWith(
  request: TaskRequest,
  task: AgentTask,
  gates: readonly string[],
): Promise<VerifyResult> {
  request.onPhase?.("format");
  await format(task, request.ops);
  request.onPhase?.("gates");
  return verify(gates, task.cwd, async (command, dir) => {
    const result = await request.ops.run(gateCommand(command), dir);
    return result;
  });
}

/** How many times the spec reviewer may flag a deviation before the loop hands off to the gate stage.
 *  After this many rounds the loop proceeds regardless — so a stuck review can't block the gate. */
const MAX_REVIEW_ROUNDS = 2;

/** The THOROUGH pre-PR gate set the caller supplied (`context.finalVerify`), or an EMPTY list when the caller
 *  wants ONE gate set — then the fast `context.verify` verdict IS the final one and no second pass runs. */
function finalGates(request: TaskRequest): readonly string[] {
  return request.context.finalVerify ?? [];
}

/** How many times the executor may re-attempt the gates after a red verdict (re-dispatched with the
 *  errors). After this many fix rounds a still-red run opens a draft for a human; bounded so a stuck run
 *  can't loop forever (cost + time). */
const MAX_FIX_ROUNDS = 2;

/** Run a spec-compliance review and re-dispatch the provider when the reviewer finds a deviation — up to
 *  MAX_REVIEW_ROUNDS rounds. Emits the `review` phase before the first review so the orchestration is
 *  visible. A provider without a `reviewCommand` returns compliant on the first call; the phase is still
 *  emitted so the phase sequence is predictable regardless of provider. */
async function specReviewLoop(request: TaskRequest, task: AgentTask): Promise<void> {
  request.onPhase?.("review");
  const reviewOpts = { auth: request.auth, ops: request.ops, provider: request.provider };
  let result = await specReviewOnce(request.issue, task, reviewOpts);
  let round = 0;
  while (!result.compliant && round < MAX_REVIEW_ROUNDS) {
    round += 1;
    // oxlint-disable-next-line no-await-in-loop -- spec-review rounds are inherently sequential
    await dispatch(
      { ...task, plan: specFixPrompt(result.feedback) },
      request.provider,
      request.ops,
    );
    // oxlint-disable-next-line no-await-in-loop -- review after each correction, in order
    result = await specReviewOnce(request.issue, task, reviewOpts);
  }
}

/** The wall-time budget (minutes) for the WHOLE fix-round phase — a single fix can't grind past this (#676 saw
 *  a fix-round running the full suite for 35+ min). Once the budget is spent the loop stops re-dispatching and
 *  lets the still-red verdict draft, rather than hang. */
const FIX_ROUND_BUDGET_MIN = 10;

/** Milliseconds per minute — the fix-round budget is expressed in minutes for readability, converted here. */
const MS_PER_MINUTE = 60_000;

/** The fix-round wall-time budget in milliseconds (the minute budget converted). */
const FIX_ROUND_BUDGET_MS = FIX_ROUND_BUDGET_MIN * MS_PER_MINUTE;

/** Whether another fix round may run — the provider run is healthy, the gates are still red, the attempt cap
 *  is not yet reached, AND the wall-time budget from `startedAt` is not yet spent. The wall-time bound is what
 *  stops one fix grinding for 35+ min (#676); the attempt cap bounds the count. */
function mayFix(outcome: TaskOutcome, round: number, startedAt: number): boolean {
  const withinBudget = Date.now() - startedAt < FIX_ROUND_BUDGET_MS;
  return outcome.run.ok && !outcome.verdict.ok && round < MAX_FIX_ROUNDS && withinBudget;
}

/** Re-attempt the FAST gates with the executor fixing its OWN failures — up to MAX_FIX_ROUNDS re-dispatches
 *  AND within the wall-time budget, each fed the prior verdict's errors (`fixPrompt`) then re-formatted +
 *  re-gated against the fast `context.verify` (not the whole-repo suite). Returns the final fast outcome
 *  (green, or still-red after the rounds → a draft). A failed provider run is returned as-is. */
async function iterate(
  request: TaskRequest,
  task: AgentTask,
  initial: TaskOutcome,
): Promise<TaskOutcome> {
  let outcome = initial;
  let round = 0;
  const startedAt = Date.now();
  while (mayFix(outcome, round, startedAt)) {
    round += 1;
    request.onPhase?.("fix");
    // oxlint-disable-next-line no-await-in-loop -- the fix rounds are inherently sequential
    const run = await dispatch(
      { ...task, plan: fixPrompt(outcome.verdict) },
      request.provider,
      request.ops,
    );
    // oxlint-disable-next-line no-await-in-loop -- gate after each fix, in order
    const verdict = await gateWith(request, task, request.context.verify);
    outcome = { run, verdict };
  }
  return outcome;
}

/** Run the THOROUGH pre-PR verify ONCE after the fast fix rounds converged green — the full `vp check` +
 *  `pnpm -r test` (`context.finalVerify`), so the published verdict carries the whole wall while the per-fix
 *  loop stayed fast (#676). Skipped entirely when no distinct `finalVerify` was set (the fast verdict IS the
 *  final), or when the fast outcome isn't green (a still-red fast verdict drafts as-is — no point re-running
 *  the heavy suite on a known-red run); otherwise the thorough verdict decides merge vs. draft. */
async function finalize(
  request: TaskRequest,
  task: AgentTask,
  fast: TaskOutcome,
): Promise<TaskOutcome> {
  const gates = finalGates(request);
  if (gates.length === 0 || !fast.run.ok || !fast.verdict.ok) {
    return fast;
  }
  const verdict = await gateWith(request, task, gates);
  return { run: fast.run, verdict };
}

/** Develop the task inside its worktree — dispatch the provider, run the spec-compliance review (before the
 *  quality gates, so "green but wrong" is caught first), auto-format + gate against the FAST gates, let the
 *  executor fix its OWN gate failures (up to MAX_FIX_ROUNDS, within the wall-time budget) so a strict-wall
 *  lint/type slip self-corrects instead of drafting, then run the THOROUGH final verify ONCE before publishing
 *  (#676 — per-fix fast, the published verdict full). The spec review only runs when the provider succeeded
 *  (nothing to review if the run failed). Still red → a DRAFT. Each step emits a `Phase` via `onPhase`; the
 *  worktree setup + teardown stay in `runTask`. */
async function develop(request: TaskRequest, task: AgentTask): Promise<TaskOutcome> {
  request.onPhase?.("develop");
  const run = await dispatch(task, request.provider, request.ops);
  if (run.ok) {
    await specReviewLoop(request, task);
  }
  const verdict = await gateWith(request, task, request.context.verify);
  const fast = await iterate(request, task, { run, verdict });
  const outcome = await finalize(request, task, fast);
  await publishOutcome(request, task, outcome);
  request.onPhase?.("done");
  return outcome;
}

/** The task for `request` in its isolated worktree — the per-issue branch, the worktree path (distinct from
 *  the repo root so `git worktree add` succeeds + the run is isolated), the execute-role model, and the gated
 *  plan. The plan is built from the scaffolded TEMPLATE when the caller resolved one (`context.planTemplate`),
 *  so a user-edited `.claude/prompts/plan.md` drives the LIVE run, not only the `vow agent plan` preview;
 *  absent => the built-in default. */
function taskFor(request: TaskRequest, worktree: string): AgentTask {
  const { auth = "subscription", context, issue, provider } = request;
  return {
    auth,
    branch: branchFor(issue),
    cwd: worktree,
    // The runner develops the gated plan — the EXECUTE role, so a cheaper model suffices (drift-proof).
    model: modelFor(provider.models, "execute"),
    plan: buildPlan(issue, context, context.planTemplate),
    title: issue.title,
  };
}

/** Add `task`'s worktree (at `task.cwd`), develop in it, then tear it down — but ONLY one THIS call's
 *  `worktreeAdd` actually created. A FAILED add (the path already exists — a duplicate run-all arg, a
 *  collision) must NOT run `worktreeRemove`, which would force-remove a SIBLING lane's live worktree at the
 *  same path and fail both; the `added` flag (set only past a resolved add) guards the teardown. */
async function developInWorktree(request: TaskRequest, task: AgentTask): Promise<TaskOutcome> {
  const { ops } = request;
  let added = false;
  try {
    await ops.worktreeAdd(task.cwd, task.branch);
    added = true;
    return await develop(request, task);
  } finally {
    if (added) {
      await ops.worktreeRemove(task.cwd);
    }
  }
}

/**
 * One full loop over an issue: set up an isolated worktree (a path distinct from the repo, under
 * `.vow-worktrees/`), build the gated plan + dispatch the provider in it, re-run the gates there, and tear
 * the worktree down (only one this task created — see `developInWorktree`). The whole agent loop as a single
 * call — provider-neutral, every effect injected via `request.ops`, tested end-to-end without claude or git.
 */
export async function runTask(request: TaskRequest): Promise<TaskOutcome> {
  const worktree = worktreePath(request.cwd, branchFor(request.issue));
  const task = taskFor(request, worktree);
  request.onPhase?.("worktree");
  const outcome = await developInWorktree(request, task);
  return outcome;
}
