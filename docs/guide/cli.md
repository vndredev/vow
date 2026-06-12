---
group: Reference
order: 2
---

# The CLI (`vow`)

The studio is **run by a person** with the `vow` CLI and **operated by an LLM** through the [MCP](/guide/mcp). They split cleanly: `vow` covers **running the apps** (run · status · stop) and the **basics** (check · build · test) — the process work that doesn't belong in an LLM tool — while the MCP is the authoring surface (vows · data · the plan).

## Install

The CLI ships in the repo as `@vow/cli`, wired as a workspace dependency — after `vp install` it's available as `pnpm vow` (or directly as `vow` with `node_modules/.bin` on your `PATH`):

```bash
pnpm vow            # the help
```

## Running the apps

`vow serve` is the central **local hub** — the one front door that brings up the studio + the docs (and with them the `/__vow/*` control API) under one supervised process. It is where the persistent MCP channel and the agent watch-loop join next (see [the hub](/guide/serve)). `vow dev` is the same supervised runner aimed at one app while you work on it. Both stream their combined logs (each line tagged with the app), free an orphaned port first (no more `pkill`), and you background them yourself. `vow status` / `vow stop` work off the fixed ports, so they find the apps no matter who started them.

```bash
vow serve            # the local hub — studio + docs + the /__vow control API
vow dev              # run studio + docs (the default set), streaming
vow dev all          # run every app (studio · docs · starter)
vow dev studio       # run one
vow status           # which app ports are responding
vow stop             # stop every app — frees their ports
vow stop docs        # stop one
```

| App       | URL                     |
| --------- | ----------------------- |
| `studio`  | <http://localhost:5173> |
| `docs`    | <http://localhost:5174> |
| `starter` | <http://localhost:5175> |

## The basics

One front door over the toolchain — flags pass straight through:

```bash
vow check            # vp check (fmt + lint + typecheck)
vow check --fix      # --fix is forwarded
vow build            # vp build, every app
vow build studio     # one app
vow test             # pnpm -r test (per-package — never `vp test`, which can't resolve jsdom)
vow smoke            # boot the dev app + assert its client bundle is browser-safe (default: studio)
vow pr-body --check  # validate a PR body (piped on stdin) against the template, before gh pr create
```

`vow smoke` is the runtime gate the static ones miss: it boots `vp dev`, crawls the client module graph, and fails if any `node:` builtin leaked into the browser bundle — a class of bug that lint, type-check, and the production build all pass (the build tree-shakes the leak away; the tests run in Node).

`vow pr-body --check` is the **pre-flight** for the PR-body gate: it runs the exact same `prBodyProblems` rule CI runs, so a missing or empty template section (Summary / What / Proof / Next) is caught locally, never first in CI. Pipe the body in before opening the PR:

```bash
vow pr-body --check < body.md && gh pr create --body-file body.md
```

## Realtime observability

```bash
vow events           # print the recorded trace — the hub's live activity stream
```

The hub records what it does to an append-only feed (`.vow/events.jsonl`): a develop run starting (`run.started`), each phase (`run.phase`), a run finishing (`run.finished`), a merge (`pr.merged`). `vow events` prints the recent trace; the studio renders the same stream as a live panel, and an orchestrator tails the log to react to observed state (see [the local hub](/guide/serve#roadmap)). The feed is best-effort — recording an event never breaks the operation it observes.

## The agent loop

`vow agent` scaffolds and drives the **agent-native layer** — autonomous agents developing issues through vow's verification gates, opening PRs, and merging when green. One per vow; the executor is an LLM (Claude, Codex, etc.), not the user.

```bash
vow agent init                                          # scaffold AGENTS.md + the develop/orchestrate/audit skills + prompts
vow agent plan <n>                                      # print the verification-gated plan for issue <n>
vow agent run <n>                                       # develop issue <n>, open a PR
vow agent run <n> --dry-run                             # preview the run (branch, commands, gates)
vow agent run <n> --provider <name>                     # use a different provider (default: claude)
vow agent run <n> --auth api                            # use API key auth (default: subscription)
vow agent run <n> --json                                # emit NDJSON per phase (for LLM / studio)
vow agent run-all <n>... [--provider <name>]            # develop multiple issues concurrently
vow agent merge <pr>                                    # merge a green PR / draft a red one (no merge off red)
vow agent audit --file <findings.json>                  # file audit findings as vow issues
```

The gates (`vp check` + `pnpm -r test`) run in the worktree after the provider completes — a PR merges only when the gates pass. Dry-run shows the branch, commands, and expected gates without running them.

`init` also scaffolds the operative agent **prompts** as editable templates under `.claude/prompts/` — `develop.md`, `audit.md`, and `plan.md`. These ARE the agent's behaviour: `vow agent plan` builds its plan from `plan.md`, and `vow agent audit` runs `audit.md` (with `{dimension}` filled in). The agent READS the scaffolded file, falling back to vow's built-in default when it is absent — so editing a prompt tunes the agent without touching vow's source. `init` is idempotent: it never clobbers a prompt you have edited.

These prompts are the **single source of truth across every surface**: the `vow-develop` and `vow-audit` skills are POINTERS — they tell a session to read `.claude/prompts/develop.md` / `.claude/prompts/audit.md` rather than restating their own copy, and a host-orchestration script reads the same file through ONE shared reader (`readPrompt` from `@vow/cli/agent-prompts`, with the same built-in-default fallback). Edit one prompt file and the native agent, the skill, and the orchestration all change together.

::: tip The split is the point
**`vow` is for people; the [MCP](/guide/mcp) is for LLMs.** Process management (run · stop · status) lives in the CLI, never in an LLM tool; authoring (vows · records · the plan) lives in the MCP, never in the CLI.
:::
