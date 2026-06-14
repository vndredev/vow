---
group: Reference
order: 5
---

# The local hub — `vow serve`

`vow serve` is vow's central **local** runtime: one supervised front door, on your own machine, for operating vow. It is the application of vow's one principle — _everything through vow, nothing around it_ — to how you run it day to day: instead of a dev server per app plus an MCP spawned per editor session plus agents started by hand, there is **one always-on hub**.

::: warning Foundation status
All three elements are in — the front door, the persistent MCP channel, and the agent watch-loop. The realtime-observability stream (the channel the orchestrator + the studio read) is the next arc. Marked honestly — the hub is built slow, element by element.
:::

## What it serves

```bash
vow serve              # the hub — studio + docs + the MCP channel (watch loop off)
vow serve all          # every app (studio · docs · starter) + the MCP channel
vow serve --watch --yes  # also run the agent watch-loop (the always-on self-heal engine)
```

- **studio** (<http://localhost:5173>) — the dashboard: operate vow, see the issue board, the data.
- **docs** (<http://localhost:5174>) — these docs, the generated vow app.
- **the MCP channel** (<http://localhost:5176/mcp>) — the persistent agent channel: any number of agents/clients POST to one always-on server, replacing the stdio-per-editor-session launch (see [the MCP](/guide/mcp)).
- **the event channel** (<http://localhost:5177/events>) — the **provider-neutral** realtime-observability feed over SSE: any client (the studio's browser, a generic agent, an orchestrator, a `curl`) subscribes to one always-on endpoint and receives the backlog, then each new event live. Same feed as the tailable `.vow/events.jsonl` + [`vow events`](/guide/cli#realtime-observability).
- **the studio trace** — the studio's event-trace panel ([`events: { as: trace }`](/guide/views)) subscribes to the live SSE stream, so `run.started` / `run.phase` / `pr.merged` appear **instantly**, not within a poll. It reads the SSE over the studio's own `/__vow/events` (an `EventSource`) — true realtime under plain [`vow dev`](/guide/cli#running-the-apps), not only the hub. Like the loop status, the feed is read from the **repo-root** `.vow/events.jsonl` the loop records to — resolved by walking up from the studio's app dir, so the studio under `apps/studio` shows the loop's live events, not an app-local copy. The 5s poll stays a graceful fallback when SSE is unavailable, so an event is never dropped or duplicated.
- **the `/__vow/*` control API** — issues, the agent-trigger, the agent-loop status, the data layer — rides on the studio's dev server via `@vow/vite-plugin`, so serving the hub serves the control plane too.
- **the agent-loop status** (`GET /__vow/agent-loop/status`) — the autonomous loop made **observable**: whether autonomy is on (`running`), the current `round`, the effective `backlog` + `openPrs` the round saw, and when it `lastRound`ed. The studio reads it through the `useAgentLoopStatus()` store hook, polled on focus + a 5s interval like the issue plan and the trace. See [The agent-loop status](#the-agent-loop-status) below.
- **the board-status reconcile** — every tick the hub reconciles the GitHub Project's Status to the studio's derived truth (the board invariant), so any drift — a raw merge, a manual close, a flaky Project workflow — is auto-corrected within an interval, never needing a manual `sync_project`. A no-op when no Project is configured.

It reuses the same supervised runner as [`vow dev`](/guide/cli#running-the-apps): combined tagged logs, an orphaned port freed first, foreground until interrupted (background it yourself — the harness, `&`, a supervisor).

## The agent-loop status

The autonomous loop runs in its own process — `vow serve --watch --yes` (the hub daemon) or `vow agent auto --yes` (a one-shot spiral). The studio's dev server can't read that process's memory, so the loop publishes its live state through a **status file**, the same local-first seam the [event feed](#what-it-serves) uses:

1. **The loop records** its round state to `<repo>/.vow/loop-status.json` **as each round advances** — not once at the idle default (#673), so the cockpit tracks the round being worked, never a frozen snapshot. Each advance writes the live counts: `running`, the advancing `round`, the effective `backlog` (the within-cap, PR-less issues it develops) and `openPrs` read **now** (the count drops as PRs merge), and a fresh `lastRound`. The write is **atomic** (write-temp-rename, so a reader never sees a half-written file) and **best-effort** (recording the state never breaks the round it observes).
2. **The dev-API serves it** at `GET /__vow/agent-loop/status`, read from the **repo-root** `.vow/` the loop records to — resolved by walking up from the studio's app dir, so the studio under `apps/studio` still reads the loop process's live state, not an app-local copy. When no loop has ever run (the file is absent), it answers the idle default `{ running: false, round: 0, backlog: 0, openPrs: 0 }`.
3. **The studio reads it** through the `useAgentLoopStatus()` hook in `@vow/store`, polled on focus + a 5s interval (mirroring `useIssues` / `useEvents`). A malformed response degrades to the same idle default — the surface is read-only and never throws.

```bash
# Watch the loop's status as it spirals (the same JSON the studio polls):
curl -s http://localhost:5173/__vow/agent-loop/status
# {"running":true,"round":2,"backlog":3,"openPrs":1,"lastRound":"2026-06-13T…Z"}
```

This is the **read** half of the cockpit — the loop observable from the studio. Start/stop **control** over the same surface (`POST /__vow/agent-loop/control`) is its own gated follow-up.

## The operations cockpit

The studio's **Cockpit** (the Operations home, `apps/studio/app/cockpit.vow.md`) is the single pane of glass over the autonomous system — built, like every studio page, from vow blocks + tokens, no hand-written markup. Each section is a paneled [`Card`](/guide/primitives/card) (a bordered, padded surface from the tokens), stacked with breathing room:

- **The agent loop** — `loop: { as: status }`, a generated view element (`VowAgentLoopStatus`) bound to the `useAgentLoopStatus()` hook. It **composes vow primitives** — a [`Badge`](/guide/primitives/badge) for the run state (a positive tone when **running**, neutral when **idle**) above a [`Stats`](/guide/primitives/stats) stat-card grid for the round's `round` / `backlog` / `openPrs` metrics (plus the optional last-round) — so it inherits the design language exactly like the Board/Table views, not bespoke classed markup. The [agent-loop status](#the-agent-loop-status) made visible. Read-only: the loop is observed here, never driven from this element.
- **Active agents** — `loop: { as: agents }`, a generated view element (`VowAgentPanel`) derived live from the same `/__vow/events` SSE feed as the trace (no separate endpoint). An issue is "active" from its `run.started` event until its matching `run.finished`. The panel renders one [`Card`](/guide/primitives/card) per in-flight run — the issue number, the dispatched TEAM specialist (from `run.started.detail`), and the current phase (from the latest `run.phase`) as [`Badge`](/guide/primitives/badge)s in the header, then a scrolling [`Table`](/guide/primitives/table) of tool-call rows (`agent.tool` events) — timestamp · tool name (Edit/Write → accent, others → neutral) · summary. Until `agent.tool` events are emitted by the loop (a sibling issue), each card shows "Waiting for tool events…" as a clean zero state. The derivation (`activeRunsFrom`) is pure + exported — unit-testable without a DOM or a live feed.
- **The trace** — `events: { as: trace }`, the live agent-run feed (`run.started` / `run.phase` / `pr.merged`) over the same SSE stream as [what it serves](#what-it-serves). It renders as a structured [`Table`](/guide/primitives/table), **newest-first**, in aligned columns: the time formatted to `HH:MM:SS` (never the raw ISO string), a [`Badge`](/guide/primitives/badge) per `kind` coloured by meaning (started/publish → accent, done/merged → success, failed → danger, a phase → neutral), the `#issue`, then the phase/detail — capped in height and scrolled, so a long run stays a contained, scannable feed. The cockpit **is** the single Operations pane; there is no separate Trace page.
- **Health** — `mcp: { as: status }`, a generated view element reading `/__vow/mcp/status` — whether the channel is connected (derived from event-feed freshness), how many tools the vow MCP server registers, and the newest event's kind + timestamp. Composes a [`Badge`](/guide/primitives/badge) (connected/disconnected by tone) and a [`Stats`](/guide/primitives/stats) grid for the health metrics.

The `as:` value picks the fixed component the plugin materialises — so the cockpit can never bind a component the plugin didn't write. Each element composes the closed primitive registry (Badge · Stats/Stat · Card · the Table parts), materialised on demand into `.generated/`.

One piece is **deliberately deferred**, noted in the cockpit doc itself so the surface never oversells:

- **Loop on/off control** arrives with **#623** — it needs a cross-process stop signal, the write half of the read-only status surface above.

## Everything local

The hub runs on **your machine**. The agent loop, the worktrees, the provider, and the **worktree-safe** verify (`vp check` + the touched package's tests) — all local. The loop's final verify deliberately does **not** run the whole-repo `pnpm -r test`: it can't, inside a develop worktree (a worktree's `.git` is a file, not a directory, so the full suite throws `fatal: not a git repository` and drafted every run, [#685](/guide/agent#fast-fix-rounds-thorough-final-verify)). **GitHub Actions stay only as the PR gates** (CI runs the full `pnpm -r test` in a real-repo checkout · the PR-body check · branch-protection drift); they validate a PR — the full-suite backstop behind the worktree-local verify — they never drive the loop. No GitHub runner runs the agent, and no Cloudflare is required.

## Roadmap

The hub is built in three elements, each its own gated change:

1. ✅ **The front door** — `vow serve` supervises studio + docs + the `/__vow` control API.
2. ✅ **The persistent MCP channel** — the MCP server over a local HTTP transport (`/mcp` on :5176) mounted on the hub: stateless (one request = one exchange, the studio shared across requests), so any number of agents/clients POST into one always-on server instead of the stdio-per-editor-session launch.
3. ✅ **The agent watch-loop** — `vow serve --watch` runs the self-heal loop in the hub daemon, **opt-in only** via `--yes` / `VOW_AGENT_AUTO=1` (the [#486](/guide/agent) gate): a spiral runs, then re-runs every 60s, developing new issues as they appear and merging green; the daemon stays up between spirals, the inter-spiral wait abortable for a prompt shutdown. Default (no `--watch`) is off. On startup it **prunes a prior run's stale worktrees** (`.vow-worktrees/feat-issue-N`) so a restart never hits "branch already used by worktree" — an in-flight run's worktree (an issue with an open PR) is spared. Each round develops a batch **partitioned by area** — at most one issue per `area:` label — so concurrent develops touch disjoint files and converged work merges instead of [drafting on a rebase conflict](/guide/agent#partitioned-rounds-one-issue-per-area-so-converged-work-merges-instead-of-drafting).

**The realtime-observability arc** (#497). The hub records a live event feed — `run.started` / `run.phase` / `run.finished` / `pr.merged` today — to `.vow/events.jsonl`, exposed two **provider-neutral** ways: the tailable file + [`vow events`](/guide/cli#realtime-observability), and the **SSE event channel** (`/events` on :5177) any client subscribes to. The channel is observability: you watch, you don't narrate. Provider-neutral by construction — no agent is special.

### The Claude Code Channels adapter

One thin per-provider adapter sits on the neutral feed: **`vow channel`** bridges it into a connected [Claude Code session via Channels](https://code.claude.com/docs/en/channels.md) — it pushes each new event in as a `<channel source="vow" …>` event, so the orchestrator reacts to observed state without being told (one-way: it acts through vow's tools). The vow CLI installs it:

```bash
vow agent init   # adds the vow-channel server to .mcp.json (idempotent)
# then launch Claude Code with the channel (research preview):
claude --dangerously-load-development-channels server:vow-channel
```

A Codex/Gemini channel would be its own adapter on the same feed — the core stays neutral. (The **studio panel** — the control + 100%-trace, on/off — needs a generic live-data view block first; [#502](https://github.com/vndredev/vow/issues/502).)
