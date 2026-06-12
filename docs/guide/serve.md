---
group: Reference
order: 5
---

# The local hub — `vow serve`

`vow serve` is vow's central **local** runtime: one supervised front door, on your own machine, for operating vow. It is the application of vow's one principle — _everything through vow, nothing around it_ — to how you run it day to day: instead of a dev server per app plus an MCP spawned per editor session plus agents started by hand, there is **one always-on hub**.

::: warning Foundation status
Elements **1 (the front door)** and **2 (the persistent MCP channel)** are in; the agent watch-loop is the last element (see [Roadmap](#roadmap)). Marked honestly — the hub is being built slow, element by element.
:::

## What it serves

```bash
vow serve            # the hub — studio + docs + the MCP channel
vow serve all        # every app (studio · docs · starter) + the MCP channel
vow serve studio     # one surface + the MCP channel
```

- **studio** (<http://localhost:5173>) — the dashboard: operate vow, see the issue board, the data.
- **docs** (<http://localhost:5174>) — these docs, the generated vow app.
- **the MCP channel** (<http://localhost:5176/mcp>) — the persistent agent channel: any number of agents/clients POST to one always-on server, replacing the stdio-per-editor-session launch (see [the MCP](/guide/mcp)).
- **the `/__vow/*` control API** — issues, the agent-trigger, the data layer — rides on the studio's dev server via `@vow/vite-plugin`, so serving the hub serves the control plane too.

It reuses the same supervised runner as [`vow dev`](/guide/cli#running-the-apps): combined tagged logs, an orphaned port freed first, foreground until interrupted (background it yourself — the harness, `&`, a supervisor).

## Everything local

The hub runs on **your machine**. The agent loop, the worktrees, `vp check`, `pnpm -r test`, the provider — all local. **GitHub Actions stay only as the PR gates** (CI · the PR-body check · branch-protection drift); they validate a PR, they never drive the loop. No GitHub runner runs the agent, and no Cloudflare is required.

## Roadmap

The hub is built in three elements, each its own gated change:

1. ✅ **The front door** — `vow serve` supervises studio + docs + the `/__vow` control API.
2. ✅ **The persistent MCP channel** — the MCP server over a local HTTP transport (`/mcp` on :5176) mounted on the hub: stateless (one request = one exchange, the studio shared across requests), so any number of agents/clients POST into one always-on server instead of the stdio-per-editor-session launch.
3. **The agent watch-loop** — `vow agent auto --watch` running inside the hub daemon (opt-in via `--yes`, see [the agent loop](/guide/agent)), the always-on agent runtime: it spawns an agent per open issue, the daemon stays up between rounds.
