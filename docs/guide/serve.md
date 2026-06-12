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
- **the `/__vow/*` control API** — issues, the agent-trigger, the data layer — rides on the studio's dev server via `@vow/vite-plugin`, so serving the hub serves the control plane too.

It reuses the same supervised runner as [`vow dev`](/guide/cli#running-the-apps): combined tagged logs, an orphaned port freed first, foreground until interrupted (background it yourself — the harness, `&`, a supervisor).

## Everything local

The hub runs on **your machine**. The agent loop, the worktrees, `vp check`, `pnpm -r test`, the provider — all local. **GitHub Actions stay only as the PR gates** (CI · the PR-body check · branch-protection drift); they validate a PR, they never drive the loop. No GitHub runner runs the agent, and no Cloudflare is required.

## Roadmap

The hub is built in three elements, each its own gated change:

1. ✅ **The front door** — `vow serve` supervises studio + docs + the `/__vow` control API.
2. ✅ **The persistent MCP channel** — the MCP server over a local HTTP transport (`/mcp` on :5176) mounted on the hub: stateless (one request = one exchange, the studio shared across requests), so any number of agents/clients POST into one always-on server instead of the stdio-per-editor-session launch.
3. ✅ **The agent watch-loop** — `vow serve --watch` runs the self-heal loop in the hub daemon, **opt-in only** via `--yes` / `VOW_AGENT_AUTO=1` (the [#486](/guide/agent) gate): a spiral runs, then re-runs every 60s, developing new issues as they appear and merging green; the daemon stays up between spirals, the inter-spiral wait abortable for a prompt shutdown. Default (no `--watch`) is off.

**The realtime-observability arc** (#497). The hub records a live event feed — `run.started` / `run.phase` / `run.finished` / `pr.merged` today — to `.vow/events.jsonl`, exposed two **provider-neutral** ways: the tailable file + [`vow events`](/guide/cli#realtime-observability), and the **SSE event channel** (`/events` on :5177) any client subscribes to. Consumers: an **orchestrator** that acts on observed state without being told (over SSE, or — one thin per-provider adapter — pushed into a Claude Code session via [Channels](https://code.claude.com/docs/en/channels.md)), and the **studio panel** (the control + 100%-trace, on/off — coming). The channel is observability: you watch, you don't narrate. Provider-neutral by construction — no agent is special.
