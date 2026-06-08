---
group: Reference
order: 1
---

# Theming

`@vow/theme` is vow's base look — one **token system** over the `class` + `data-*` hooks the emitters produce. The adapters carry no colour or size of their own; the theme dresses them. So re-skinning the whole generated UI is editing the tokens — no rule or component changes.

## The tokens

Every visual decision is a CSS custom property under `:root` (in `vow.css`); the `.vow-*` rules only **consume** them, never hardcode a value:

- **Colour** — semantic roles, not raw swatches: `--vow-color-{bg · surface · text · muted · accent · accent-hover · ink · border · border-hover · danger · warning · success · scrim}`.
- **Type** — `--vow-font-{sans · mono}`, a size scale `--vow-text-{xs…3xl}`, `--vow-weight-*`, `--vow-leading-*`, `--vow-tracking-*`.
- **Spacing** — `--vow-space-0…9` (the steps Flex/Grid/Box `gap` / `p` map onto).
- **Containers** — `--vow-container-1…4` (the `size` of the [Container](/guide/views) primitive).
- **Radius · border · elevation** — `--vow-radius-1…3`, `--vow-border`, `--vow-shadow-{1 · popover}`.

A numeric layout prop indexes a scale: a `gap` of `n` resolves to `var(--vow-space-n)`, a Container `size` of `n` to `var(--vow-container-n)`. Swap the values, and the whole UI re-spaces from one place.

## Dark mode

Dark is the `.dark` class on `<html>` (toggled by the [shell](/guide/shell#dark-mode)): it re-declares only the colours, so every hook re-skins at once. A host can map `.dark` to a media query for OS-driven dark.

## Swap it

The look travels with vow but isn't locked in:

- **Edit the tokens** to re-skin everything (brand colours, radius, density) — no rule changes.
- **Replace the stylesheet** entirely (e.g. with the vndre.dev design tokens) for a different system over the same `class` / `data-*` hooks.

Each consumer ships its own CSS on the shared tokens — `@vow/shell` (the app chrome), `@vow/docs` (the docs chrome) — so there are **no `<style>` blocks** in any component.
