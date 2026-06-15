---
group: Reference
order: 2
---

# The CLI (`vow`)

The studio is **run by a person** with the `vow` CLI and **operated by an LLM** through the [MCP](/guide/mcp). They split cleanly: `vow` covers **running the apps** (serve · dev · status · stop) and the **basics** (check · build · test) — the process work that doesn't belong in an LLM tool — while the MCP is the authoring surface (vows · data · the plan).

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
vow pr-body --new 649  # scaffold the PR body for issue 649 (title + Closes #649)
vow pr-body --check   # validate a piped PR body against the template, before gh pr create
```

`vow smoke` is the runtime gate the static ones miss: it boots `vp dev`, crawls the client module graph, and fails if any `node:` builtin leaked into the browser bundle — a class of bug that lint, type-check, and the production build all pass (the build tree-shakes the leak away; the tests run in Node).

`vow pr-body` has two modes:

- **`--new <n>`** — scaffold the PR body for issue `<n>`: emits the template skeleton (Summary / What / Proof / Next + `Closes #N`) pre-filled with the issue title. The scaffold intentionally fails `--check` on `## What` (the bare `-` placeholder is not a real bullet), so the agent is forced to fill the bullets before the gate passes. The structure is mechanically guaranteed — the agent fills only the substance.
- **`--check`** — the **pre-flight** for the PR-body gate: runs the same `prBodyProblems` rule CI runs, so a missing or empty section is caught locally, never first in CI.

The intended flow:

```bash
vow pr-body --new 649 > body.md
# fill in the What bullets, tick Proof, adjust Next
vow pr-body --check < body.md && gh pr create --body-file body.md
```

## Guardrails — the plan + the Project

```bash
vow guard            # enforce main's protection (PR-only · gate · no bypass · 0 reviews); --check reports only
vow reconcile        # plan drift — retire candidates + issues with no phase or no pillar
vow doctor           # check the GitHub Project's Roadmap view against vow's invariant
```

`vow reconcile` and `vow doctor` are **read-only diagnostics** — they report drift, never mutate. `reconcile` surfaces issues a merged PR already closed (the retire candidates), any open issue with no phase (the "No milestone" drift the milestone gate otherwise prevents), and any with no **pillar** (off the throughline — see below).

`vow doctor` checks the upstream **GitHub Project Roadmap view** against vow's declared invariant — grouped by, dated by, and marked with **Milestone**. A [spike](https://github.com/vndredev/vow/issues/539) found the Projects v2 API can _set_ no view config (it is UI-only) and reads back only the layout + group-by, so doctor gives a real verdict on what's readable and lists the rest:

```
vow doctor — the GitHub Project Roadmap view (its config is UI-only):
  ✓ the Roadmap view exists (ROADMAP_LAYOUT)
  ✗ grouped by Status — set Group by → Milestone
  □ Date field → Milestone (UI-only: Roadmap toolbar → Date fields)
  □ Markers → Milestones (UI-only: Roadmap toolbar → Markers)
```

`✓` holds · `✗` is fixable drift doctor detected · `□` is a UI-only step to apply in the Roadmap toolbar. vow's **own** studio roadmap needs none of this — it derives the phased timeline straight from the milestones (gh-direct); this only configures the upstream GitHub Project view.

## The throughline — pillars

A milestone is a phase on the timeline (**when**); a **pillar** is the enduring capability a piece of work advances (**what**, toward the north-star). The four pillars are vow's north-star, decomposed:

| Pillar                   | Toward                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| **Describe → App**       | spec to UI — emit, primitives, the design language, the DSL       |
| **Self-building**        | the provider-neutral self-healing agent loop + the team           |
| **Self-planning**        | issues, roadmap, audit, cockpit — vow steers its own work         |
| **Mechanical integrity** | the wall — gates, hooks, the externalized picture, durable memory |

Every issue vow opens carries a `pillar:` label — `createIssue` routes one from the title + body (a theme heuristic), unless you set one explicitly. Work routes by **capability**, not the nearest date, so the plan reads as a forward compass, not only a calendar.

## Realtime observability

```bash
vow events           # print the recorded trace — the hub's live activity stream
```

The hub records what it does to an append-only feed (`.vow/events.jsonl`): a develop run starting (`run.started`), each phase (`run.phase`), a run finishing (`run.finished`), a merge (`pr.merged`). `vow events` prints the recent trace; the studio renders the same stream as a live panel, and an orchestrator tails the log to react to observed state (see [the local hub](/guide/serve#roadmap)). The feed is best-effort — recording an event never breaks the operation it observes.

## The agent loop

`vow agent` scaffolds and drives the **agent-native layer** — autonomous agents developing issues through vow's verification gates, opening PRs, and merging when green. One per vow; the executor is an LLM (Claude, Codex, etc.), not the user.

```bash
vow agent init                                          # scaffold AGENTS.md + the develop/orchestrate/audit/brainstorm skills + engineering skills + prompts + the agent team
vow agent plan <n>                                      # print the verification-gated plan for issue <n>
vow agent run <n>                                       # develop issue <n>, open a PR
vow agent run <n> --dry-run                             # preview the run (branch, commands, gates)
vow agent run <n> --provider <name>                     # use a different provider (default: claude)
vow agent run <n> --auth api                            # use API key auth (default: subscription)
vow agent run <n> --json                                # emit NDJSON per phase (for LLM / studio)
vow agent run-all <n>... [--provider <name>]            # develop multiple issues concurrently
vow agent merge <pr>                                    # merge a green PR / draft a red one (no merge off red)
vow agent auto --yes                                    # the self-heal loop — audit + develop + merge, unsupervised
vow agent audit --file <findings.json>                  # file audit findings as vow issues
```

The gates (`vp check` + `pnpm -r test`) run in the worktree after the provider completes — a PR merges only when the gates pass. Dry-run shows the branch, commands, and expected gates without running them.

`init` also scaffolds the operative agent **prompts** as editable templates under `.claude/prompts/` — `develop.md`, `audit.md`, and `plan.md`. These ARE the agent's behaviour: `vow agent plan` builds its plan from `plan.md`, and `vow agent audit` runs `audit.md` (with `{dimension}` filled in). The agent READS the scaffolded file, falling back to vow's built-in default when it is absent — so editing a prompt tunes the agent without touching vow's source. `init` is idempotent: it never clobbers a prompt you have edited.

`/vow-brainstorm` is the Socratic front-door for the spec-first loop: one clarifying question at a time, a **hard gate** before any file is written, then a draft `.vow.md` spec + a `gh issue create` call after explicit approval. It turns a vague idea into a well-specified issue the loop can pick up without stalling on under-specification. The skill is part of the develop/orchestrate/audit/brainstorm skills `init` scaffolds.

`init` further wires the **guardrail hooks** into `.claude/settings.json` (merged beside any hooks you already have): the **PreToolUse** guard (`vow hook` blocks a wrong Bash call — a direct push to `main`, a raw `gh pr create`, `vp check --fix` — with the vow alternative) and the **SessionStart** trigger (`vow hook session-start` injects the `using-vow` bootstrap as every session's first context, so vow's red line + gates + team auto-fire). The wired command is the **local bin** — `$CLAUDE_PROJECT_DIR/node_modules/.bin/vow hook` — so it resolves for a project with vow as a local dependency, with no global install on `PATH`. See [the agent layer](./agent.md#the-guardrail-hooks) for the full mechanism.

::: tip Wire the hooks after install
The hooks ship in the committed `.claude/settings.json`, so a repo that already ran `init` brings them to every contributor automatically. For a _fresh_ project that just added vow as a dependency, run `vow agent init` once after `vp install` — it is the documented setup step that wires the hooks (and scaffolds the team + skills + prompts). It is intentionally **not** a `postinstall` script: that would run during a dependency install (clobbering a consuming repo's files, failing under `--ignore-scripts`/CI). `init` is idempotent, so re-running it on an already-wired repo is a clean no-op.
:::

`init` also scaffolds the **engineering-discipline skill library** — six reusable technique files under `.claude/skills/`: `test-first` (write the failing test first), `verification-before-completion` (run the gates and include the evidence before reporting done), `systematic-debugging` (root-cause before fix), `condition-based-waiting` (poll a condition, never a blind sleep), `defense-in-depth` (validate at every layer boundary), and `how-to-write-a-vow-skill` (the meta-skill that teaches the pattern so the library self-extends). Each has a WHEN-to-use `description` that fires as a context-matching trigger; the body is the technique, not a workflow summary. They are sourced from `packages/agent/src/skills.ts` — add an entry there, and every future `vow agent init` scaffolds it.

These prompts are the **single source of truth across every surface**: the `vow-develop` and `vow-audit` skills are POINTERS — they tell a session to read `.claude/prompts/develop.md` / `.claude/prompts/audit.md` rather than restating their own copy, and a host-orchestration script reads the same file through ONE shared reader (`readPrompt` from `@vow/cli/agent-prompts`, with the same built-in-default fallback). Edit one prompt file and the native agent, the skill, and the orchestration all change together.

::: tip The split is the point
**`vow` is for people; the [MCP](/guide/mcp) is for LLMs.** Process management (serve · dev · stop · status) lives in the CLI, never in an LLM tool; authoring (vows · records · the plan) lives in the MCP, never in the CLI.
:::
