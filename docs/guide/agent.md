---
group: Reference
order: 4
---

# The agent layer (`@vow/agent`)

::: warning Foundation status
Today this is the **provider-neutral seam** — the `Provider` interface, the Claude Code adapter, the registry. The loop on top (plan → dispatch → verify → PR → trigger) is the next elements. What's here is the foundation everything else hangs on.
:::

vow's north star is operation by a person _or_ an LLM. The agent layer is the second half: vow describes a unit of work; an autonomous coding CLI develops it. The one rule, learned the hard way, is **provider-neutrality** — Claude Code, Codex, and Gemini are interchangeable adapters behind one interface. The loop never names a provider.

## The seam

A `Provider` turns a task into the **command** that runs it headlessly — _built, never run here_, so the mapping is pure and unit-testable (a runner execs it):

```ts
interface AgentTask {
  branch: string;
  cwd: string;
  plan: string;
  title: string;
}
interface Command {
  bin: string;
  args: readonly string[];
}
interface Provider {
  name: string;
  command(task: AgentTask): Command;
}
```

The `plan` is a self-contained, verification-gated spec (the [shadcn/improve](https://github.com/shadcn/improve) discipline: STOP conditions, an out-of-scope list, a commit stamp) — written for the weakest plausible executor, so a cheaper model can run it without drifting.

## Claude Code today

```ts
claudeCode.command(task);
// → { bin: "claude",
//     args: ["-p", task.plan, "--permission-mode", "acceptEdits", "--output-format", "json"] }
```

`-p` is headless print mode; the runner sets the cwd to the task's git worktree. Codex and Gemini join the registry as further adapters over the _same_ `Provider` — the loop above is unchanged. `providerFor(name)` resolves one; nothing above this layer may hardcode a CLI (a gate will enforce that, #107).

## The plan is the product

`buildPlan(issue, context)` turns an issue into the spec the executor follows — self-contained, so a model that never saw this session runs it without outside context:

```ts
buildPlan(
  { number: 98, title: "the loop", body: "…" },
  { commit: "abc1234", verify: ["`vow smoke` is green"] },
);
// # Plan: the loop (#98)
// Written against commit `abc1234`. Verify HEAD still matches before you start …
// ## Verification gates  — vp check · pnpm -r test · vow smoke (machine-checkable; never judge yourself)
// ## Out of scope · ## STOP conditions (stop and report, never improvise)
```

Every plan carries the always-on gates (`vp check`, `pnpm -r test`), the issue's extra gates, an out-of-scope list, STOP conditions, and the **commit stamp** it was written against — so the executor catches a stale plan before touching anything.

## Isolated dispatch

`dispatch(task, provider, ops)` develops a task in its own git worktree — create it on the task's branch, run the provider's command there, and _always_ tear it down (even if the run fails). The side effects (git, exec) are injected as `ops`, so the orchestration is pure and tested without touching git or spawning a CLI:

```ts
await dispatch(task, claudeCode, ops);
// ops.worktreeAdd(cwd, branch) → ops.run(claudeCode.command(task), cwd) → ops.worktreeRemove(cwd)
```

The worktree is the **isolation** that lets a fleet of agents run in parallel without colliding on the working tree — the foundation for stepping on the gas with multiple agents at once.

## Verify, then PR

After the run, `verify(gates, cwd, run)` re-runs every gate (the improve "review like a tech lead" — done-criteria re-checked, never trusted); the verdict is the conjunction. Then the branch is pushed and `gh pr create` opens the PR — **a red run opens a DRAFT**, surfaced for a human, never mergeable:

```ts
const verdict = await verify(plan.gates, cwd, run);
prCreateArgs(title, prBody(plan, verdict), verdict.ok); // verdict.ok === false → adds "--draft"
```

Merging always stays a human's call — the loop develops, verifies, and proposes; it never merges itself.

## The loop, in one call

`runTask(request)` is the whole loop as a single, provider-neutral call — build the gated plan, set up an isolated worktree, dispatch the provider in it, re-run the gates _in that worktree_, and always tear it down:

```ts
const outcome = await runTask({ issue, context, cwd, provider: claudeCode, ops });
// ops.worktreeAdd → dispatch(plan, worktree) → verify(gates, worktree) → ops.worktreeRemove (always)
// → { run, verdict }
```

Every effect is injected via `ops`, so the entire loop is tested end-to-end without running claude or touching git. The worktree's lifecycle lives here, not in `dispatch` — verify must see the agent's changes _before_ teardown.

## The `vow agent run` CLI

`vow agent run <issue> [--provider <name>] [--auth subscription|api] [--json]` develops a single issue:

- **`--provider`** chooses which LLM runs the plan (default: the configured `DEFAULT_PROVIDER`; `--provider codex` is a stub for Codex or any future provider added to the registry).
- **`--auth subscription|api`** controls authentication: `subscription` (the default) strips the `ANTHROPIC_API_KEY` from the spawned provider's environment, so it uses the user's Anthropic subscription; `api` passes the key through, paying per token. Foundation: this boundary is tested (`childEnv` seam in real-ops).
- **`--json`** emits NDJSON for LLM consumption and the studio: each phase as `{"issue": n, "phase": "..."}`, then the final verdict as `{"issue": n, "ok": true|false}`. Human terminal gets text by default.

The run streams each phase live (worktree setup → dispatch → gates re-run → publish), then opens a PR: green runs open a standard PR (mergeable); red runs open a DRAFT (surfaced for a human, never auto-merged).

## The `vow agent run-all` CLI

`vow agent run-all <issue>... [--provider <name>] [--auth subscription|api] [--json]` develops multiple issues **concurrently in isolated worktrees** (up to 3 in parallel, capped to avoid machine swamp). Each issue streams its own phase lines; results are printed per-issue (text or NDJSON). Exits non-zero if any gate failed.

This is vow's own orchestration — no external CI/CD or Kubernetes — a provider-neutral fleet on your machine. `mapLimit` caps the lane count; each worker is a full `develop` loop.

## The roadmap

✓ provider abstraction → ✓ plan-builder → ✓ dispatch → ✓ verify + PR → ✓ `runTask` (the loop, one call) → ✓ `realOps` (the real exec — git worktrees + the CLI spawned via `execFileSync`; each run is its own process, so the sync exec doesn't block a parallel fleet) → ✓ `vow agent run <n>` + `run-all <n>...` (the CLI front-door — develops issues in worktrees and opens PRs, draft if gates fail; live-streaming progress; auth choices; NDJSON for LLMs) → next: the **trigger** (channel / board drag). The whole thing is vow's own, provider-neutral — not a dependency on any single CLI's orchestration.
