---
group: Reference
order: 2
---

# The CLI (`vow`)

The studio is **run by a person** with the `vow` CLI and **operated by an LLM** through the [MCP](/guide/mcp). They split cleanly: `vow` covers the **dev lifecycle** (run · status · logs · stop the apps) and the **basics** (check · build · test) — the process work that doesn't belong in an LLM tool — while the MCP is the authoring surface (vows · data · the plan).

## Install

The CLI ships in the repo as `@vow/cli`, wired as a workspace dependency — after `vp install` it's available as `pnpm vow` (or directly as `vow` with `node_modules/.bin` on your `PATH`):

```bash
pnpm vow            # the help
```

## The dev lifecycle

`vp dev` runs one app in the foreground; `vow dev` runs them **managed, in the background** — fixed ports, a PID/port registry (`.vow/dev.json`), logs under `.vow/logs/`, and a clean restart every time (it first frees a port held by an orphan, so there's no more `pkill`).

```bash
vow dev              # run studio + docs (the default set)
vow dev all          # run every app (studio · docs · starter)
vow dev studio       # run one
vow status           # which apps are up — port · pid · responding
vow logs studio      # the recent log
vow logs studio -f   # follow it
vow stop             # stop all running apps (terminates the whole process group)
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
```

::: tip The split is the point
**`vow` is for people; the [MCP](/guide/mcp) is for LLMs.** Process management (run · stop · status) lives in the CLI, never in an LLM tool; authoring (vows · records · the plan) lives in the MCP, never in the CLI.
:::
