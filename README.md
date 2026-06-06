# vow

**The spec-driven AI Dev Suite for Vue** — built on [VoidZero](https://voidzero.dev/) / Vite+.

You describe your app as a tree of **vows** (promises) in `app/<slug>.vow.md`; vow generates a type-safe Vue app that you own — and proves it kept the promise. Operable by a human _and_ an LLM.

> **Foundation phase.** The core mechanism works end-to-end (entity · view · bind · primitives · scenario-coverage · local-state CRUD · layout). The surface — more field types, the primitive ladder, patterns, routing, persistence, and an MCP server — grows slowly, element by element. See the [roadmap](./docs/guide/roadmap.md).

## What it looks like

One file — `app/task.vow.md`:

```markdown
---
id: vow_task
fulfills: emit entity
---

# A task someone must do

## fields

- title: text, required
- done: boolean
- status: select(todo|doing|done)
```

→ vow generates the `Task` type, a validating factory, derived tests, and a default CRUD list (into `.generated/`, never edited). You write the intent; vow keeps the promise.

## Two ways to work

- **Free** — read one `llms.txt` and write `.vow.md` directly; the core (parse · gate · tsgo) keeps errors at zero.
- **MCP** _(planned)_ — a typed toolbox for token-efficient, direct work.

## Stack

Vite+ · Vitest · Rolldown · Oxc · tsgo (VoidZero) · Vue 3 · Cloudflare (target backend). vow is the **intent layer** on top — it doesn't reinvent the toolchain, it builds on it.

## Develop

```bash
pnpm install
vp dev apps/showcase        # the showcase app
vp check                # format · lint · typecheck
pnpm -r test            # tests (per package)
pnpm --filter @vow/docs run docs:dev   # the docs
```

## Docs

The full guide lives in [`docs/`](./docs/guide/) — what vow is, the Vow primitive, app structure, emit/bind/proof, primitives, and the roadmap.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). vow is built slowly, element by element; every change ships green (`vp check` + `pnpm -r test`) with its own doc page.

## License

[MIT](./LICENSE) © Andre Schmidt ([vndre.dev](https://vndre.dev))
