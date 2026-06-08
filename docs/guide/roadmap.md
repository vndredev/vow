---
group: Project
order: 0
---

# Roadmap

## The north star: a studio

vow's goal isn't a dashboard — it's a **studio**: the one connected place where you **build**, **plan** and **design** an app, all from the **same vows**. A vow is a unit of work, a design spec, and an app feature at once, so the three surfaces are **views of one truth** and move together. Anyone working with vow works in the studio.

The dogfood: vow's own studio is built in vow — vow is planned, designed and developed in it. This page is the first proof of it.

## The roadmap derives itself

A roadmap you hand-maintain drifts — exactly like GitHub Projects' one status field. vow's doesn't: it's **read off the truth**, the same way a vow's status is derived from its proof, never stored.

- **Done** is the **git history** — every merged change (day 1 → now), each carrying its proof + CI.
- **In flight** is the open vows — declared, not yet green.
- **Next** is the path below.

So there is no second copy to keep in sync: the studio's planning **is** this roadmap, and this roadmap is read from the same place the app is. (Turning git + coverage + CI into the timeline is the **observability adapter** in the path — today this is the concept, shown with the real history.)

## The three surfaces

All over the same vows:

- **Build** — describe the app as vows; vow generates it (entities · views · forms), type-checked and proven. _Largely here today._
- **Plan** — a board / roadmap over the vows. **Derived status** (`proposed → building → proving → done / blocked`, from proof + git + CI) is read-only; **intentional status** (priority · iteration · assignee · labels, order) is draggable and writes back into the vow.
- **Design** — components, tokens and the look are vows too: see, compose and tune the design system in place.
- **Connected + operated** — one source; edit one surface, the others follow; operated by a **person or an LLM** (the author layer + MCP).

## The path to the studio

**Phase 1 — Data-display primitives.** `Table` (header · rows · cells, then sort/filter) · `Card` · `Stats` · `Callout`. The entity list becomes a real **Table**. → see your vows as data.

**Phase 2 — View patterns + slicing.** The `## view` vocabulary gains `table` · `cards` · `board` · `detail` · `stats`; **group-by · sort · filter**. → slice the data on any field.

**Phase 3 — The plan surface.** Kanban — group a view by a field → lanes; **drag** a card → writes back. The two kinds of status come alive: derived = read-only, intentional = draggable. `rollup` bubbles derived status **vow → epic → roadmap**.

**Phase 4 — Connected + real.** in-memory → **Cloudflare D1** behind the `useCollection` seam; the **observability adapter** (git + coverage + CI → the derived timeline — _this is what makes the roadmap derive itself_); the **GitHub adapter** (issues / PRs / CI).

**Phase 5 — Operated by an LLM.** `serialize` (Vow → vow.md) · a typed **mutation API** · the **vow MCP server** — so a person or an agent drives the studio, validated _before_ writing.

**The design surface** runs alongside: the remaining UI primitives the patterns pull in (`Callout` · `Avatar` · `Tooltip` · `Menu` · `Toast` · `Pagination` · `Breadcrumb` · `Empty-state`), multi-value fields, field-presentation control, the value→variant map for status badges — all visible and tunable in the studio.

## Where we are (the derived timeline)

The truth, read from git — day 1 (5 Jun 2026) to now:

- **The core** _(5–6 Jun)_ — the framework-agnostic [component model](/guide/components) + Vue adapter; the `## view` layout path + [layout primitives](/guide/views); [theme tokens](/guide/theming); the boot generated from a `root` vow (no hand-written `src/`).
- **The spec hardens** _(7 Jun)_ — YAML `## view`; entity decoupled from its rendering (entity = model); a token-driven theme over the whole surface; the **self-documenting [docs system](/guide/doc-system)** + a full hardening pass (the language + drift gates).
- **Toward the studio** _(8 Jun)_ — `reference` fields + the shared [store](/guide/data); the UI foundation ([primitives](/guide/primitives) · variants · [forms](/guide/emit) · routing); the [app shell](/guide/shell) + an [architecture](/guide/architecture) overhaul + `llms.txt`; icons + [badge](/guide/primitives/badge) + referent-display + docs dogfooding.

::: warning Foundation phase
Everything in the timeline is green and live; everything in **the path** is declared, not yet shipped. These docs stay 1:1 with what git actually records — the roadmap can't oversell, because it's derived.
:::
