---
group: Docs
order: 0
---

# The doc-system

These docs are **not a separate framework** — they are a **generated vow app** (`apps/docs`). The same
`vow()` plugin that builds the starter generates this site; the doc-specific parts are composed from
small vow packages, never bent into the generation core. What you are reading was produced by the
pipeline below.

::: tip Dogfooded
Every feature on this page — callouts, code-groups, the live demos under [UI](/guide/primitives), the
sidebar, this "on this page" rail — is built from vow's own packages. The docs are how we prove them.
:::

## Markdown → the core: `@vow/markdown`

`@vow/markdown` turns markdown into vow's **UiNode model** (the same adapter-neutral component tree the
emitters use) — not an HTML blob, not a Vue-locked SFC. Headings, paragraphs, lists and inline marks
become element + text nodes; fenced code becomes a raw, Shiki-highlighted node. On top of that it adds
the doc features: `:::` callouts, `::: code-group`, `<<<` file snippets, `::: demo`, and the
h2/h3 headings that feed this page's TOC.

## The docs feature: `@vow/docs`

`@vow/docs` is a reusable Vite plugin, `vowDocs()`, that any vow app can add. It scans a folder of
plain `.md` (this repo keeps it in `/docs`), and for each file generates a prose `.vue` page via
`@vow/markdown` → `emitProse`. It also derives the **sidebar** from each page's `group`/`order`
frontmatter, generates the **chrome** (nav + sidebar + TOC layout), and materialises the components the
pages reference — `CodeGroup`, the `::: demo` wrappers, and the primitive adapters those demos import
(by calling `@vow/emit-primitive` — composition, the core stays untouched).

## Routing: `@vow/router`

`@vow/router` is a tiny client router. The generated boot builds one routes table — the app's root page
plus the docs pages — and mounts the page matching the URL inside the chrome. **One central Vite+ server
serves every page**; internal links navigate without a full reload.

## Composed components

vow distinguishes two layers:

- **Primitives** (atoms) — `@vow/headless` + `@vow/emit-primitive`: single accessible widgets
  (`checkbox`, `collapsible`, `tabs`, `dialog`, `select`). Only what HTML can't do natively.
- **Composed components** (molecules) — built _from_ primitives + data. The docs **sidebar** is the
  first one: each group is a `collapsible`; a `::: code-group` is a tab switcher over its code panels.

## Styling & tokens

Styling is layered, both halves built on **one set of tokens**:

::: code-group

```css [@vow/theme/vow.css — the design system]
/* tokens (the single source of design values) + the base look of what the core generates */
:root {
  --vow-color-accent: #3451b2;
  --vow-space-4: 1rem;
  /* … */
}
.vow-checkbox {
  /* primitives, layout, entity views — shared by any vow app */
}
```

```css [@vow/docs/style.css — the docs layer]
/* the docs site's own stylesheet — chrome + prose + extensions, on the tokens above */
.vow-nav {
  /* … */
}
.vow-sidebar__items {
  border-left: 1px solid var(--vow-color-border);
}
.vow-doc h2 {
  /* prose typography */
}
```

:::

There are **no `<style>` blocks** in any component — every rule lives in one of the two stylesheets, and
each consumer package (like `@vow/docs`) ships its own CSS on top of the shared `@vow/theme` tokens.
