---
group: Reference
order: 4
---

# The agent layer (`@vow/agent`)

::: tip What's built
The full loop is built on a **provider-neutral seam** — the `Provider` interface, the Claude Code adapter, the registry. On top of it: the plan-builder, isolated dispatch, verify + PR, `runTask` (the loop in one call), `realOps` (the real exec), the `vow agent run` / `run-all` / `merge` / `auto` CLI, and the **Start work** trigger ([the roadmap](#the-roadmap)). The loop **dispatches the [elite team](#the-elite-team)** (#638): it routes each issue by its `area:` label to the matching specialist and injects that agent's **complete** brief — its role, discipline, and vow's wall — into the develop plan, not a thin per-area sketch. There is **one** source of agent definitions (`team.ts`), so the autonomous loop and interactive orchestration dispatch the very same specialists.
:::

vow's north star is operation by a person _or_ an LLM. The agent layer is the second half: vow describes a unit of work; an autonomous coding CLI develops it. The one rule, learned the hard way, is **provider-neutrality** — Claude Code, Codex, and Gemini are interchangeable adapters behind one interface. The loop never names a provider.

## The elite team

A sprawling 28-package project can't be carried by one generalist juggling everything, so the work is divided among **owners** — one specialist subagent per concern. `vow agent init` scaffolds each to `.claude/agents/<name>.md` (Claude Code's custom-subagent format), committed so the team travels with the repo. The right specialist is dispatched by the issue's `area:` label — both by an interactive orchestrator **and by the autonomous loop**, off the same routing table. The team is two kinds of member:

- **The builder** — [`vow-developer`] is the general executor: it takes any issue and carries it end-to-end through the red line (branch → develop → verify → document → PR → agent-merge), reusing what vow already does before adding code, right-sizing to one coherent element per PR. Without it, end-to-end building would fall to a `general-purpose` stand-in instead of a real team member.
- **The guardians** — one owner per area, each paired with the gate that mechanically enforces it, so the specialist's judgement and the wall agree:
  - **`layer-architect`** — the 4-layer DAG + module boundaries (no upward import, no cycle, the index is the only entry, files split by concern under the max-lines cap).
  - **`type-sentinel`** — the strict type + lint wall (`vp lint` = 0; an `as`/`any`/`!` on a real data path narrowed at its source).
  - **`security-auditor`** — the trust boundaries (injection, path-traversal, an unhandled throw, a non-atomic write).
  - **`framework-neutrality-guard`** — the emitters describe UI in the neutral component model; a concrete framework lives only behind its adapter seam.
  - **`provider-neutrality-guard`** — a provider CLI bin is named only at the provider seam, never hunted through the loop.
  - **`coverage-keeper`** — every `proves:` scenario has a matching test; the generated UI proves itself.
  - **`docs-keeper`** — the docs stay 1:1 with reality (has-a-doc + docs-drift), honest, no overselling.
  - **`perf-auditor`** — real, scale-bound hot paths (an O(n^2) or un-memoized path, a re-read per event).
  - **`a11y-keeper`** — accessibility in @vow/headless + the generated views: keyboard operation, ARIA roles/states, live regions (WCAG 4.1.3), focus management, programmatic labels.
  - **`design-language-keeper`** — the design language: primitives consume variant·tone·size·density → `data-*`, every value reads a vow.css token, climbing the interaction ladder toward the UI-framework DSL (Phase O).
  - **`studio-dx`** — the studio cockpit: its `.vow.md` views + the `/__vow` dev-API surface, kept 100% vow (every control a primitive, every value a token).

The builder develops; the guardians keep each area honest. The **autonomous** loop (`vow agent run` / `run-all` / `auto`) develops _everything_ with the right owner: it routes each issue by its `area:` label (`teamAgentFor`) to the matching specialist — a guardian for an area's concern, the `vow-developer` builder by default — and injects that agent's **complete** system prompt (`teamFocus`: the shared preamble, vow's wall, and the specialist's own role + discipline) into the develop plan's `## Focus`. So the headless executor carries the owner's full expertise, and honours the strict wall up front instead of rediscovering it by failing a gate. There is **one** source of agent definitions — `team.ts` — and `roster.ts` is the thin routing table over it, never a second, thinner roster to drift from (#638).

## The guardrail hooks

The team (who) and the gates (the law) only help if an agent _consults them before acting_. A fresh headless session knows neither, so it rediscovers a rule by tripping a gate and failing. Two provider-neutral hooks close that gap mechanically — 90% mechanics, not a plea in a file the next session's model never reads. `vow agent init` wires both into `.claude/settings.json` (merged beside any hooks the user already has, idempotent), so the guardrails travel with the repo to every agent, not just the one who ran init.

- **PreToolUse — the guardrail** (`vow hook`): every Bash tool-call is checked, and a wrong one is **blocked in the moment** with the vow alternative — a raw `gh pr create`, a direct push to `main`, `vp check --fix`. The rules + verdict are provider-neutral; the Claude Code deny shape is a thin adapter at the seam.
- **SessionStart — the trigger** (`vow hook session-start`): at the start of _every_ session (startup, `/clear`, compact) it injects the **`using-vow` bootstrap** as the session's first context, so vow's red line, gates, and team **auto-fire** instead of being rediscovered the hard way. Modeled on the load-bearing-hook idea: force-feed the router and the rest auto-triggers.

Both hooks are wired to the **local bin**, not a bare `vow`: the committed command is `$CLAUDE_PROJECT_DIR/node_modules/.bin/vow hook` (and `… hook session-start`). A bare `vow` resolves only when vow is installed _globally_ (on `PATH`); for any local-dependency install — including vow's own monorepo — Claude Code would fire the hook and hit "command not found", so the hook would be wired but **dead**. Claude Code exports `CLAUDE_PROJECT_DIR` to every hook process as the project-root absolute path, so the command resolves regardless of the hook's working directory (which may have been `cd`-ed into a subdirectory). It's a direct bin invocation, not `npx` — the PreToolUse hook fires on _every_ Bash call, so no per-call resolution latency.

The bootstrap is a single, honest source — owned by `@vow/agent` (`sessionBootstrap()`), a tight summary of `AGENTS.md`, no overselling. It states **the rule** (_if there's even a small chance a vow discipline or skill applies, consult it BEFORE acting — including before clarifying questions_), the **red line** (plan → branch → develop → verify `vp lint` = 0 + tests → document → PR → merge-when-green), the **gates** that block drift (the quality wall, framework-neutrality, provider-neutrality, design-language coverage, the layer-DAG / no-cycle / max-lines caps, has-a-doc / docs-drift), the **team** of owners, and the skill library where the engineering-discipline techniques live.

The bootstrap text is **provider-neutral** — a pure string, no harness shape, no provider name. Each harness wraps it in its own envelope at the seam; for Claude Code that is `sessionStartOutput(bootstrap)` → `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}` printed to stdout (exit 0). A second harness is a new adapter over the _same_ text, never a rewrite.

```ts
sessionStartOutput(sessionBootstrap());
// → { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "# Using vow …" } }
```

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

The `plan` is a self-contained, verification-gated spec (vow's gated-plan discipline: STOP conditions, an out-of-scope list, a commit stamp) — written for the weakest plausible executor, so a cheaper model can run it without drifting.

## Claude Code today

```ts
claudeCode.command(task);
// → { bin: "claude",
//     args: ["-p", task.plan, "--permission-mode", "acceptEdits", "--output-format", "json"] }
```

`-p` is headless print mode; the runner sets the cwd to the task's git worktree. Codex and Gemini join the registry as further adapters over the _same_ `Provider` — the loop above is unchanged. `providerFor(name)` resolves one; nothing above this layer may hardcode a CLI — the provider-neutrality gate (#107) enforces it, scanning @vow/agent + @vow/cli + @vow/mcp and flagging a CLI bin name written outside the seam.

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

After the PR, the agent closes the loop itself: it polls CI's `gate` and acts on the verdict — a **green** run is merged autonomously (`gh pr merge --squash --delete-branch`), a **red** run is flipped back to a draft (surfaced for a human, never merged off a red gate). The loop never merges itself off red; a human only intervenes on a red run.

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

✓ provider abstraction → ✓ plan-builder → ✓ dispatch → ✓ verify + PR → ✓ `runTask` (the loop, one call) → ✓ `realOps` (the real exec — git worktrees + the CLI spawned via `execFileSync`; each run is its own process, so the sync exec doesn't block a parallel fleet) → ✓ `vow agent run <n>` + `run-all <n>...` (the CLI front-door — develops issues in worktrees and opens PRs, draft if gates fail; live-streaming progress; auth choices; NDJSON for LLMs) → ✓ `vow agent merge` (the agent-merge stage — polls CI's `gate`, merges a green PR squash+delete-branch, drafts a red one) → ✓ `vow agent auto --yes` (the self-heal loop — **opt-in only**: it audits + develops + merges unsupervised, so it refuses to start without `--yes` / `VOW_AGENT_AUTO=1`, and `--help` is help, never a launch) → ✓ `vow agent audit` → ✓ the **trigger** (the issue board's **Start work** action POSTs `/__vow/agent`, dispatching `vow agent run <n>` for the issue — the human's one signal to begin; the run's PR derives `doing`) → ✓ **team dispatch** (the loop routes each issue by its `area:` label to the matching [team](#the-elite-team) specialist and injects that agent's complete brief into the develop plan — one source of agent definitions, #638) → next: the production channel (a Worker over the GitHub API) + the real MCP-notification surface. The whole thing is vow's own, provider-neutral — not a dependency on any single CLI's orchestration.
