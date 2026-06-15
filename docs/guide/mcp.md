---
group: Reference
order: 3
---

# The MCP server (the author layer)

The studio is **operated by an agent**, not edited by hand. An LLM drives `@vow/mcp` over stdio, which composes vow's two write sides directly — **structure** (the vows) via `@vow/core`'s mutations, **data** (records) via `@vow/db`. The user _views_ the studio; the agent _changes_ it. This is vow's north star: a person _or_ an LLM operates the same truth.

## The loop

```
LLM ──► @vow/mcp ──┬─ structure ─► serialize → app/*.vow.md ─► vp dev regenerates ─► studio reloads
                   └─ data ──────► @vow/db (SQLite) ◄── /__vow/db ── studio refetches
```

A **structure** write lands in `app/<slug>.vow.md` — a running `vp dev` regenerates the `.vue`. A **data** write lands in `.vow/data.db` — the studio refetches. The same tools run against **D1** in prod, so the agent operates a deployed studio the same way.

## Set up in Claude Code

Add the vow MCP server to [Claude Code](https://claude.com/claude-code) once, from the repo root:

```bash
claude mcp add vow --scope project --env VOW_APP_DIR=apps/studio/app \
  -- node --experimental-strip-types packages/mcp/src/server.ts
```

`--scope project` writes a committed **`.mcp.json`** at the repo root, so everyone who clones gets the same server (this repo already ships it). Verify:

```bash
claude mcp list          # `vow` should be ✓ Connected
```

Then run `claude` — the tools below are available. On first use of a project server, approve it at the trust prompt (or run `/mcp` in-session). The server opens the **same** `.vow/data.db` a running `vp dev apps/studio` serves, so the agent and the studio share one source of truth.

> Edited `.mcp.json` by hand? Restart the Claude Code session to load it. Manage: `/mcp` (in-session), `claude mcp get vow`, `claude mcp remove vow --scope project`.

## Two ways to reach it

- **Per-session over stdio** — `.mcp.json` spawns the server for one editor session (above). It dies with the session; one client.
- **The persistent channel over HTTP** — [`vow serve`](/guide/serve) mounts the same tool set on an always-on local endpoint (`http://localhost:5176/mcp`), so any number of agents/clients POST to one running server. Stateless: one request = one exchange, the studio (the SQLite data layer) shared across requests. Same `@vow/mcp` tools, the [build factory](/guide/packages) shared by both transports — the set can't drift between them.

## The tools

Thirty-eight tools, in seven groups. Structure mutations **validate** (the zod schema + reference integrity) _before_ writing — a bad mutation never reaches disk.

### Read

| Tool          |                                                                               |
| ------------- | ----------------------------------------------------------------------------- |
| `list_vows`   | List every vow (slug, kind, intent).                                          |
| `get_vow`     | Get one vow by slug.                                                          |
| `studio_info` | The studio's paths + structure (app dir, db, repo, project, entities, views). |

### Structure — the vows

| Tool           |                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `add_entity`   | Add a new entity (a data model) to the studio.                                                         |
| `add_field`    | Add a field to an entity.                                                                              |
| `remove_field` | Remove a field from an entity by name.                                                                 |
| `add_view`     | Add a view (a page); `view` is a list of { type, value } nodes.                                        |
| `add_form`     | Add a form (a bound, validated `## form` over an entity): `of` + `submit`.                             |
| `set_field`    | Edit a field in place (rename, retype, required, options); a rename or retype carries the stored data. |
| `set_form`     | Edit a form's `of`/`submit`/`edit` (the singleton-editor flag) in place.                               |
| `set_seed`     | Replace an entity's `## seed` records (the sample data that travels with the spec).                    |
| `set_view`     | Replace a vow's `## view` (the page tree) in place.                                                    |
| `set_intent`   | Set a vow's intent (the `# …` promise).                                                                |
| `set_nav`      | Patch a vow's nav entry (label, icon, order, group); omitted keys keep their value.                    |
| `remove_vow`   | Delete a vow (its `.md`).                                                                              |

### Data — the records

| Tool               |                                                                          |
| ------------------ | ------------------------------------------------------------------------ |
| `list_records`     | List an entity's records.                                                |
| `get_record`       | Get one record by id.                                                    |
| `add_record`       | Add a record to an entity (an id is minted; absent fields get defaults). |
| `set_record_field` | Patch one field of a record (e.g. move a task by setting its status).    |
| `remove_record`    | Delete a record by id.                                                   |

A `reference` field on `set_record_field` accepts the target's **name**, not only its raw id — the name is resolved against the target entity's first text field, so the agent assigns work by `"Andre"`, not a copied id (an existing id still passes through; an unknown name errors).

### Docs — the guide

| Tool          |                                                                           |
| ------------- | ------------------------------------------------------------------------- |
| `list_docs`   | List the guide pages the site renders (slug, title, group).               |
| `read_docs`   | Read one guide page's markdown by slug (e.g. `mcp`, `primitives/button`). |
| `search_docs` | Search the guide pages by query — matching pages with a short excerpt.    |

These read the **same** `docs/guide/*.md` the site renders ([the doc system](/guide/doc-system) scans that one folder), so an agent reaches the docs through the front door it already drives — no HTTP-only `llms.txt`. A page's **slug** is its path under `docs/guide` with `.md` stripped (`mcp`, `primitives/button`). An absent or malformed slug returns a plain `no doc "…"` message, never an error.

### GitHub — the issue plan

| Tool           |                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `list_issues`  | List GitHub issues with their derived status (planned/doing/done).                                                |
| `add_issue`    | Open a GitHub issue (feature template + labels) — assigned, phased (the current milestone), added to the Project. |
| `close_issue`  | Close a GitHub issue (marks it done).                                                                             |
| `reopen_issue` | Reopen a closed GitHub issue (marks it planned/doing again).                                                      |
| `assign_issue` | Assign a user to a GitHub issue.                                                                                  |
| `sync_project` | Sync the GitHub Project's Status field to the studio's derived status (1:1).                                      |

### Code — code intelligence

Semantic lookups over the workspace via the bundled LSP server (`typescript-language-server`, shipped as a dependency) — provider-neutral, so any MCP-capable agent gets them (not a Claude-only plugin). The server is spawned once and reused; it waits for the project to build (the diagnostics signal) so `find_references` is complete across files, never a text match.

| Tool               |                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `find_references`  | Find every semantic reference to the symbol at file:line:character (via the LSP server) — who uses it, across files, not a text match. |
| `document_symbols` | List the symbols a file declares (functions, classes, constants) with each one's line.                                                 |
| `hover`            | The type signature + doc of the symbol at file:line:character.                                                                         |

### Plan — the local plan

vow's own plan — a SQLite DAG of work (`.vow/plan.db`), the rich structure GitHub issues can't model. The agent drives it the same way it drives issues: add items, transition them through the vow-owned lifecycle, declare dependencies, re-rank, list, and sync (pull GitHub issues in). Content stays on a thin issue; structure lives here.

| Tool                |                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `add_plan_item`     | Add an item to the local plan (title + optional pillar, priority, bound issue).              |
| `list_plan`         | List the local plan — every item, its status + pillar.                                       |
| `set_plan_status`   | Transition a plan item through the lifecycle (backlog to ready to doing to review to done).  |
| `add_plan_dep`      | Add a dependency — `item` is blocked by `dependsOn` (an edge of the plan DAG).               |
| `set_plan_priority` | Re-rank a plan item (higher priority sorts first in the ready-queue).                        |
| `sync_plan`         | Pull GitHub issues in — a new open issue becomes a backlog item, a closed issue's item done. |

This list mirrors `@vow/mcp`'s tool catalogue (`tools.ts`) — a test keeps the docs and the server in lock-step, so it can't drift.

## Run it standalone

For any other MCP client (or a smoke test):

```bash
VOW_APP_DIR=apps/studio/app pnpm --filter @vow/mcp start
```

> Built on [`serialize`](/guide/vow) (Vow → vow.md — the inverse of the parser) + the `@vow/core` mutations. The dogfood goal: vow's own roadmap is planned in the studio, operated by the agent — not in a markdown file.
