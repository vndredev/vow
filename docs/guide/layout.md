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
- **`list: <entity>`** — the generated view of an entity (`list: task` → `<Task />`, its full CRUD
  list, imported automatically). More data shapes (`table`, `cards`, `board`, `stats`) join over time.

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

Default: `size=3`. (A vertical stack is just `Flex` with `direction: column`.)

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
