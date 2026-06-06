# Roadmap

vow's goal: build a complete **dashboard / planning-system app** with the core product — operable by a human _and_ an LLM. We get there **slowly**, element by element, function by function; each element ships green and with its own doc page.

## Two ways to work with vow

Same truth, same guarantee — two interfaces:

- **Free** — the LLM reads one `llms.txt` (the whole concept), then writes `.vow.md` directly. Works with any model, no tooling. The core secures it: parse + the gate + tsgo catch invalid input with **self-healing errors**, so the LLM corrects until green.
- **MCP** — a typed toolbox (`createEntity`, `addField`, …) for token-efficient, direct work, validated _before_ writing.

Both write the same vows. The **core** is the single guarantee (errors → 0), regardless of the path — the safety lives in the core, not in the interface.

## Two strands

**Generation** — what vow emits:

- [x] `entity` — model + factory + derived tests + default CRUD list
- [x] `view` — additional views over an entity
- [x] `bind` — hand-written logic, tsgo-verified seam
- [x] checkbox primitive — agnostic core + emitted adapter, a11y proven
- [x] swappable theme
- [ ] more field types (date · select · reference) + relations
- [ ] primitive ladder: switch · dialog · tabs · select · combobox · table _(complex ones wrap Zag/Ark)_
- [ ] patterns: form · table · detail · board / kanban · stats
- [ ] layout · app shell · routing
- [ ] data adapter: in-memory → Cloudflare D1 (real persistence)

**Author layer** — how you write the spec:

- [ ] `serialize` (Vow → vow.md)
- [ ] typed mutation API (`addEntity` / `addField` / …)
- [ ] `llms.txt` (the free way — a docs export)
- [ ] vow MCP server (typed tools over the mutation API)

## The reference product

A planning-system dashboard: entities + board/kanban + stats + CRUD + persistence — driven by the **user** (clicks) and the **LLM** (operates the spec).

::: warning Honest status
Today: entity / view / bind + the checkbox primitive + scenario-coverage + local-state CRUD, all green. Everything unchecked above is planned and built slowly, one element at a time.
:::
