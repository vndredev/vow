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

## The tools

**Structure** (the vows): `add_entity` · `add_field` · `remove_field` · `add_view` · `set_intent` · `set_nav` · `remove_vow`. Each loads the tree, mutates one vow in memory, and **validates** it (the zod schema + reference integrity) _before_ writing — a bad mutation never reaches disk.

**Data** (the records): `list_records` · `get_record` · `add_record` · `set_record_field` · `remove_record`. The board's drag becomes `set_record_field` (status); adding a task becomes `add_record`.

**Read**: `list_vows` · `get_vow`.

## Run it

```bash
VOW_APP_DIR=apps/studio/app pnpm --filter @vow/mcp start
```

The server opens the **same** `.vow/data.db` the dev server serves (or `$VOW_DB_PATH`), so the agent and the studio share one source of truth. Point your MCP client at that command.

> Built on [`serialize`](/guide/vow) (Vow → vow.md — the inverse of the parser) + the `@vow/core` mutations. The dogfood goal: vow's own roadmap is planned in the studio, operated by the agent — not in a markdown file.
