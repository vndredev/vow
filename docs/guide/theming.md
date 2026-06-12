---
group: Reference
order: 1
---

# Theming

`@vow/theme` is vow's look — **"The Specification"**: terminal-grade and mono-forward, Vermilion for intent and green for proof (every prove → a green test). It's one **token system** over the `class` + `data-*` hooks the emitters produce — the adapters carry no colour or size of their own, the theme dresses them. It ships two surfaces of the same design: a warm light and the deep terminal **Nacht** ([dark](#dark-mode)). Re-skinning the whole generated UI is editing the tokens — no rule or component changes.

## The tokens

Every visual decision is a CSS custom property under `:root` (in `vow.css`); the `.vow-*` rules only **consume** them, never hardcode a value:

- **Colour** — semantic roles, not raw swatches: `--vow-color-{bg · surface · text · muted · accent · accent-hover · ink · border · border-hover · danger · warning · success · scrim}`.
- **Type** — `--vow-font-{display · sans · mono}` (Archivo Expanded · IBM Plex Sans · IBM Plex Mono, self-hosted), a size scale `--vow-text-{xs…3xl}`, `--vow-weight-*`, `--vow-leading-*`, `--vow-tracking-*`.
- **Spacing** — `--vow-space-0…9` (the steps Flex/Grid/Box `gap` / `p` map onto).
- **Containers** — `--vow-container-1…4` (the `size` of the [Container](/guide/views) primitive).
- **Radius · border · elevation** — `--vow-radius-1…3`, `--vow-border`, `--vow-shadow-{1 · popover}`.

A numeric layout prop indexes a scale: a `gap` of `n` resolves to `var(--vow-space-n)`, a Container `size` of `n` to `var(--vow-container-n)`. Swap the values, and the whole UI re-spaces from one place.

## Dark mode

Dark is vow's signature — the deep terminal **Nacht**, on the `.dark` class on `<html>` (toggled by the [shell](/guide/shell#dark-mode)): it re-declares only the colours, so every hook re-skins at once. The light surface is the same design in daylight — the same warm-graphite family, the same Vermilion intent and green proof. A host can map `.dark` to a media query for OS-driven dark.

## Swap it

The look travels with vow but isn't locked in:

- **Edit the tokens** to re-skin everything (brand colours, radius, density) — no rule changes.
- **Replace the stylesheet** entirely for a different system over the same `class` / `data-*` hooks.

Each consumer ships its own CSS on the shared tokens — `@vow/shell` (the app chrome), `@vow/docs` (the docs chrome) — so there are **no `<style>` blocks** in any component.

## Pick a theme — `theme`

The generated boot imports one theme stylesheet; the `theme` plugin option chooses which. It defaults to `@vow/theme/vow.css`, so a plain `vow()` ships the base look. Point it at any stylesheet that re-declares the `--vow-*` tokens to re-skin the whole app from the config — no rule, component, or `vow.md` changes:

```ts
// vite.config.ts
import { vow } from "@vow/vite-plugin";

export default defineConfig({
  plugins: [vow({ theme: "@acme/brand.css" })],
});
```

A custom theme can `@import "@vow/theme/vow.css"` and redefine only the tokens it changes (additive over the base), or stand alone. The self-hosted fonts are exposed at `@vow/theme/fonts/*` for a theme that reuses them.
