---
group: Reference
order: 5
---

# The local hub — `vow serve`

`vow serve` is vow's central **local** runtime: one supervised front door, on your own machine, for operating vow. It is the application of vow's one principle — _everything through vow, nothing around it_ — to how you run it day to day: instead of a dev server per app plus an MCP spawned per editor session plus agents started by hand, there is **one always-on hub**.

::: warning Foundation status
This is **element 1** of the hub (the front door). It brings up the apps + the control API today; the persistent MCP channel and the agent watch-loop are the next two elements (see [Roadmap](#roadmap)). Marked honestly — the hub is being built slow, element by element.
:::

## What it serves

```bash
vow serve            # the hub — studio + docs (the default set)
vow serve all        # every app (studio · docs · starter)
vow serve studio     # one surface
```

- **studio** (<http://localhost:5173>) — the dashboard: operate vow, see the issue board, the data.
- **docs** (<http://localhost:5174>) — these docs, the generated vow app.
- **the `/__vow/*` control API** — issues, the agent-trigger, the data layer — rides on the studio's dev server via `@vow/vite-plugin`, so serving the hub serves the control plane too.

It reuses the same supervised runner as [`vow dev`](/guide/cli#running-the-apps): combined tagged logs, an orphaned port freed first, foreground until interrupted (background it yourself — the harness, `&`, a supervisor).

## Everything local

The hub runs on **your machine**. The agent loop, the worktrees, `vp check`, `pnpm -r test`, the provider — all local. **GitHub Actions stay only as the PR gates** (CI · the PR-body check · branch-protection drift); they validate a PR, they never drive the loop. No GitHub runner runs the agent, and no Cloudflare is required.

## Roadmap

The hub is built in three elements, each its own gated change:

1. **The front door** _(this page)_ — `vow serve` supervises studio + docs + the `/__vow` control API.
2. **The persistent MCP channel** — the MCP server over a local HTTP/SSE transport mounted on the hub, so any number of agents/clients dock into one always-on server (today the MCP is spawned per editor session over stdio).
3. **The agent watch-loop** — `vow agent auto --watch` running inside the hub daemon (opt-in via `--yes`, see [the agent loop](/guide/agent)), the always-on agent runtime: it spawns an agent per open issue, the daemon stays up between rounds.
