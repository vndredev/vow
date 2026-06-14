---
group: Docs
order: 0
---

# The doc-system

These docs are themselves a **generated vow app** (`apps/docs`). The same `vow()` plugin that builds the
starter builds this site; the doc-specific parts (`:::` callouts, Shiki code, live demos) come from small
`@vow/*` packages, not from changes to the core. What you're reading was produced by the pipeline below.

::: tip Dogfooded
Every feature on this page — callouts, code-groups, the live demos under [UI](/guide/primitives), the
sidebar, this "on this page" rail — is built from vow's own packages. The docs are how we prove them.
:::

## Markdown → the core: `@vow/markdown`

`@vow/markdown` turns markdown into vow's **UiNode model** (the same adapter-neutral component tree the
emitters use) — not an HTML blob, not a Vue-locked SFC. Headings, paragraphs, lists and inline marks
become element + text nodes; fenced code becomes a raw, Shiki-highlighted node. On top of that it adds
the doc features: `:::` callouts, `::: code-group`, `<<<` file snippets, `::: demo`, inline
`:badge[Done]{variant=success}` + `:icon[plus]` (vow's own Badge/Icon, right in prose), `::: timeline`
(the [changelog](/guide/changelog)'s history, generated from `git log` via `@vow/observability`), and the
h2/h3 headings that feed this page's TOC.

## The docs feature: `@vow/docs`

`@vow/docs` is a reusable Vite plugin, `vowDocs()`, that any vow app can add. It scans a folder of
plain `.md` (this repo keeps it in `/docs/guide`), and for each file generates a prose `.vue` page via
`@vow/markdown` → `emitProse`. It also derives the **sidebar** from each page's `group`/`order`
frontmatter, builds a **search index** (page titles + headings), generates the **chrome** (nav +
sidebar + TOC layout), and materialises the components the pages reference — `CodeGroup`, the
`::: demo` wrappers, a `<Checkbox>` for every markdown task list (`- [x]`), and the primitive adapters
those use (by calling `@vow/emit-primitive` — composition, the core stays untouched).

## `llms.txt` — the docs for an LLM

vow is LLM-first, so the docs ship in a form a model can read whole. On every build, `@vow/docs` writes two files to the site root — the [llmstxt.org](https://llmstxt.org) convention:

- **`/llms.txt`** — a curated index: the title, a one-line summary, and every page as a grouped link with a short description.
- **`/llms-full.txt`** — the entire documentation inlined into one file, so a model loads it all in one request.

Both are generated from the same markdown the site renders, so they can't drift — vow generates them from its own docs pipeline, no external plugin.

## Routing: `@vow/router`

`@vow/router` is a tiny client router. The generated boot builds one routes table — the app's root page
plus the docs pages — and mounts the page matching the URL inside the chrome. **One central Vite+ server
serves every page**; internal links navigate without a full reload.

## Composed components

vow distinguishes two layers:

- **Primitives** (atoms) — `@vow/headless` + `@vow/emit-primitive`: single accessible widgets
  (`checkbox`, `switch`, `radio`, `collapsible`, `tabs`, `dialog`, `select`) — only what HTML can't do
  natively — plus the structural `button` and `field`.
- **Composed components** (molecules) — built _from_ primitives + data. The docs **sidebar** is one
  (each group is a `collapsible`); the **⌘K search** and the **mobile nav drawer** are both built on
  the `dialog` primitive; a `::: code-group` is a tab switcher over its code panels. Chrome icons come
  from **`@vow/icons`** (a swappable Lucide adapter).

## Styling & tokens

Styling is **three layers**, each built on the one below and all on **one set of tokens** —
`@vow/theme` tokens → `@vow/shell` chrome → `@vow/docs` docs layer:

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

```css [@vow/shell/style.css — the app chrome]
/* the dashboard Shell — the swappable chrome the generated *.layout.vue wraps every page in */
.vow-shell {
  /* sidebar + main layout, shared by any vow app that ships chrome */
}
```

```css [@vow/docs/style.css — the docs layer]
/* the docs site's own stylesheet — prose + extensions, on the layers above */
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

There are **no `<style>` blocks** in any component — every rule lives in one of these three
stylesheets, and each consumer package (`@vow/shell`, `@vow/docs`) ships its own CSS on top of the
shared `@vow/theme` tokens. The generated `*.layout.vue` imports `@vow/shell/style.css` alongside the
theme, so the chrome layer is loaded for any vow app with more than a home page — not just the docs.
