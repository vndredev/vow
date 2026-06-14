---
group: UI
order: 2
---

# Views

A view is a **`## view`** section — a YAML list of components. Each item is one component, keyed by
name: a **semantic block** (`hero`, `features`, `list`) for the common case, or a **primitive**
(`flex`, `grid`, `box`, text) as the escape hatch. It's authored _inside_ the `.vow.md`, so the spec
stays the single source of truth — and you never see the generated Vue/React.

## The `## view` block

Under `## view`, a fenced `yaml` block lists the page's components, top to bottom:

```yaml
- hero:
    eyebrow: vow
    title: The spec-driven framework for Vue
    lead: You write the intent; vow generates the app.
- features:
    - title: Vows, not a codebase
      body: You write .vow.md; generated code never is.
    - title: Proven, not claimed
      body: Every promised scenario needs a green test.
- list: task # a generated view, by entity slug
```

In a view vow (`fulfills: emit view`, optionally `root: true` for the entry page), that renders to a
Vue SFC wrapped in a `vow-app` root — the hero, the feature grid, then the live task list. No
`main.ts`, no hand-written `.vue`.

## Semantic blocks

The catalog of ready-made components — you name them, vow brings the markup:

- **`hero`** — `{ eyebrow?, title?, lead? }` → a column with an eyebrow, headline and lead.
- **`features`** — a list of `{ title?, body? }` → a three-column grid of cards.
- **`list: <entity>`** — the generated view of an entity (`list: task` → `<Task />`, a **table** — a header
  from the fields, a row per record — imported automatically). **Read-only by default**; opt a row action in
  with `list: { of: task, actions: [delete] }` (see [Row actions](#row-actions)).
- **`stats: { of: <entity>, by: <select field> }`** — a generated **counts strip**: one
  [`Stat`](/guide/primitives/stats) per option of the field, counting the rows in that group, live from
  the store (`stats: { of: task, by: status }` → backlog 3 · doing 2 · done 5).
- **`cards: <entity>`** — a generated **card grid**: one [`Card`](/guide/primitives/card) per record
  (live from the store), titled by the entity's first text field, the rest of the fields in its body
  (`cards: task`).
- **`board: { of: <entity>, by: <select field> }`** — a generated **kanban**: a column per option of the
  field, each record's card in its column (live from the store); **drag** a card to another column and it
  writes the field back.
- **Slicing** — **`sort`** (a field), **`filter`** (`{ field: value }`) and **`group`** (a field → sections)
  via the object form: `list: { of: task, group: status }` · `cards: { of: task, sort: title }` · `board: { of: task, by: status, filter: { priority: high } }`. (`sort`/`filter` on all three; `group` on `list`/`cards` — the board already groups by its `by`.)
- **`timeline: {}`** — the git-derived **roadmap**: every change on `main` (newest first), grouped by
  date, each a type [`Badge`](/guide/primitives/badge) + a PR link — baked from `git log` at generate
  time (the same engine as the docs' `::: timeline`). Never hand-typed.
- **`events: { as: trace }`** — the **live agent-run trace**: every `run.started` / `run.phase` / `pr.merged`
  the loop and its agents emit, read live over the studio's `/__vow/events` SSE stream (no baked data). It
  composes the [`Table`](/guide/primitives/table) parts into a structured, newest-first feed of aligned
  columns — the time formatted to `HH:MM:SS` (never the raw ISO string), a [`Badge`](/guide/primitives/badge)
  per `kind` coloured by meaning (started/publish → accent, done/merged → success, failed → danger, a phase →
  neutral), the `#issue`, then the phase/detail. The studio [Cockpit](/guide/serve#the-operations-cockpit)
  panel binds to it.
- **`loop: { as: status }`** — the **live agent-loop status**: whether autonomy is running or idle and the
  round's `round` / `backlog` / `openPrs` metrics, read live from `/__vow/agent-loop/status` (no baked data).
  It composes a [`Badge`](/guide/primitives/badge) for the run state (tone by `running`) above a
  [`Stats`](/guide/primitives/stats) stat-card grid for the metrics. The
  [Cockpit](/guide/serve#the-operations-cockpit) composes it with the trace. Read-only — control is a
  follow-up (#623).
- **`issues: { as: table | roadmap | board }`** — the studio's **live GitHub issues**, read over the
  `/__vow/issues` dev API: a [`Table`](/guide/primitives/table) feed (`as: table`), the milestoned
  [`timeline`](#) roadmap (`as: roadmap`), or a drag-to-restatus [`board`](#) (`as: board`). The plan IS
  GitHub — never baked data.
- **UI primitives** — place a [primitive](/guide/primitives) directly: `- button: { label: Save, variant: outline }`,
  `- checkbox: { label: Subscribe, model: subscribed }`, likewise `badge` · `switch` · `radioGroup` · `select` · `field` ·
  `callout` · `collapsible` · `tabs` · `dialog` · `contextMenu`. The node name is the primitive's PascalCase name with a
  lowercased first letter (the `RadioGroup` adapter is the `radioGroup` node). Its **composable parts** are placeable too —
  a `card` holds a `cardHeader` + `cardBody`; a `table` holds a `tableHead`, `tableRow` and `tableCell`; a `stats` strip
  holds `stat` tiles. The reserved **`model:`** key becomes a `v-model`. The set is a **closed registry** — vow
  materialises only the adapters a view references, and an unknown name fails loud at generate time.
- **`icon: { name }`** — a glyph from [`@vow/icons`](/guide/primitives/button#icon), by semantic name
  (`plus` · `trash` · `pencil` · `arrow-right` · `check` · `x` · `search` · `menu` · `chevron-down`/`-right` ·
  `sun` · `moon` · `monitor`). Sizes with the surrounding font (`1em`), inherits `currentColor`.
- **`link: { to, label, icon? }`** — an internal link the router intercepts (no full reload); an optional
  leading `icon`. A [`button`](/guide/primitives/button) likewise takes an `icon` (e.g. `- button: { label: Add, icon: plus }`).

**Pages & routing.** The `root: true` view is the app's home (`/`); **every other view and every `emit form`
becomes a page at `/<slug>`** automatically — vow generates the route table, the boot serves them from one
client router, and a `link:` navigates between them without a reload.

## Row actions

A `list:` is **read-only by default** — the studio's stance, where the agent mutates the data through the
[MCP](/guide/mcp). Opt a per-row action in with `actions:` on the object form:

```yaml
## view

- list: { of: task, actions: [delete] }
```

`actions: [delete]` adds a trailing **Actions** column with a per-row delete [`button`](/guide/primitives/button)
(a `trash` icon and a per-row `aria-label`). The delete is wired to the store **by the row's id**, never the
displayed position — so it removes the right record even when the list is sorted, filtered or grouped. The same
list is emitted once per entity; if **any** referencing `list:` opts in, the column appears. Only `delete` is
recognised today (edit is on the roadmap); everything else stays read-only.

## Primitives — the escape hatch

The catalog is **sugar over primitives**; nothing a block does is impossible here. A primitive node
carries props plus an optional `children:` list (more components):

```yaml
- flex:
    direction: column
    gap: 4
    children:
      - h1: Anything custom
      - text: free-form content
```

A numeric prop is passed as a number (`gap: 4` → `:gap="4"`), anything else as a string. Text tags
`h1` · `h2` · `h3` · `p` · `span` wrap their value; `text` is a bare string node.

### Stack

A vertical stack — a flex column with a gap, the most common page/form arrangement. Sugar for
`flex: { direction: column }`: `- stack: { gap: 4, children: [...] }`. Its one prop is `gap` (a step on
the spacing scale, default `4`).

### Flex

| Prop        | Values                                              | CSS               |
| ----------- | --------------------------------------------------- | ----------------- |
| `direction` | `row` · `column` · `row-reverse` · `column-reverse` | `flex-direction`  |
| `align`     | `start` · `center` · `end` · `baseline` · `stretch` | `align-items`     |
| `justify`   | `start` · `center` · `end` · `between`              | `justify-content` |
| `wrap`      | `nowrap` · `wrap` · `wrap-reverse`                  | `flex-wrap`       |
| `gap`       | a number — a step on the spacing scale              | `gap`             |

`start` / `end` / `between` translate to `flex-start` / `flex-end` / `space-between`. Defaults:
`direction=row`, `align=stretch`, `justify=start`, `wrap=nowrap`, `gap=0`.

### Grid

| Prop      | Values                                              | CSS                     |
| --------- | --------------------------------------------------- | ----------------------- |
| `columns` | a number (equal tracks) or a template string        | `grid-template-columns` |
| `align`   | `start` · `center` · `end` · `baseline` · `stretch` | `align-items`           |
| `justify` | `start` · `center` · `end` · `between`              | `justify-content`       |
| `gap`     | a number — a step on the spacing scale              | `gap`                   |

Defaults: `columns=1`, `align=stretch`, `justify=start`, `gap=0`.

### Box

| Prop     | Values                                 | CSS       |
| -------- | -------------------------------------- | --------- |
| `p`      | a number — a step on the spacing scale | `padding` |
| `width`  | any CSS length                         | `width`   |
| `height` | any CSS length                         | `height`  |

Defaults: `p=0`; `width` / `height` unset unless given.

### Container

| Prop   | Values                | CSS                       |
| ------ | --------------------- | ------------------------- |
| `size` | `1` · `2` · `3` · `4` | `max-width` (+ centering) |

Default: `size=3`. Place it as `- container: { size: 2, children: [...] }`. (For a vertical stack, reach for
[`Stack`](#stack) — a flex column with a `gap`.)

## Why this is framework-free and 100% flexible

These are **not** primitives in the [accessibility](/guide/primitives) sense — a flex `<div>` is
native, so they carry no ARIA. They are structural [`Component`s](/guide/components) rendered by
`renderVueSfc`; a future React/Solid adapter renders them too. And because the catalog is only sugar
over the primitive escape, anything from a landing page to a SaaS screen is expressible — bindings,
events and conditionals grow on the same model.

## Spacing & sizing tokens

Numeric props index a scale in `@vow/theme` (`vow.css`), so the whole UI re-spaces from one place. A
`gap`/`p` of `n` resolves to `var(--vow-space-<n>)`; a Container `size` of `n` to `var(--vow-container-<n>)`.

| Token               | Value     | Token               | Value    |
| ------------------- | --------- | ------------------- | -------- |
| `--vow-space-0`     | `0`       | `--vow-space-5`     | `1.5rem` |
| `--vow-space-1`     | `0.25rem` | `--vow-space-6`     | `2rem`   |
| `--vow-space-2`     | `0.5rem`  | `--vow-space-7`     | `2.5rem` |
| `--vow-space-3`     | `0.75rem` | `--vow-space-8`     | `3rem`   |
| `--vow-space-4`     | `1rem`    | `--vow-space-9`     | `4rem`   |
| `--vow-container-1` | `28rem`   | `--vow-container-3` | `55rem`  |
| `--vow-container-2` | `43rem`   | `--vow-container-4` | `71rem`  |
