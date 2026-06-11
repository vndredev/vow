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

## The roadmap

The loop, element by element: **provider abstraction** ✓ → **plan-builder** ✓ → dispatch in an isolated worktree → verify the gates + open the PR → trigger (board drag `planned → doing`). The whole thing is vow's own, provider-neutral — not a dependency on any single CLI's orchestration.
