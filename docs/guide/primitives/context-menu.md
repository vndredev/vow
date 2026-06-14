---
group: UI
order: 3.45
---

# Context menu

A right-click menu: a list of actions summoned at the cursor over any target. It's how a board card, a table row, or a tree node offers its actions without a permanent button. Modelled on the WAI-ARIA APG menu: a `role="menu"` panel of `role="menuitem"` buttons, focus moved into the panel on open, the highlight tracked with `aria-activedescendant` (no per-item focus).

## The contract

The behaviour lives in the framework-free core (`@vow/headless`), conformant with the WAI-ARIA APG:

| Concern  | Rule                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Elements | a slot **trigger** (your content) over a floating `<div role="menu">` of `<button role="menuitem">`               |
| Open     | the adapter opens it on the trigger's `contextmenu` (right-click), positioning the panel at the cursor            |
| Focus    | moves into the panel on open; the highlight is tracked via `aria-activedescendant`                                |
| Keyboard | **↑/↓** move the highlight (wrapping), **Home/End** jump to first/last, **Enter/Space** commit, **Esc/Tab** close |
| Commit   | the chosen value surfaces via the core's `chosen` (output-only); the adapter re-emits it as `select`              |
| Dismiss  | Escape, Tab, an outside pointer, or committing an item                                                            |

## Props, events & slots

| Prop / slot | Type                                 | Purpose                                                     |
| ----------- | ------------------------------------ | ----------------------------------------------------------- |
| `items`     | `{ value: string; label: string }[]` | the menu entries                                            |
| _(default)_ | slot                                 | the trigger — the content a right-click opens the menu over |

Emits `select: string` — the chosen item's `value` — on commit. The menu owns its own open/active state (it's summoned, not `v-model`-controlled), so the host only supplies `items` and reacts to `select`.

```md
## view

- context-menu: { items: [{ value: edit, label: Edit }, { value: delete, label: Delete }] }
```

## Styling hooks

The adapter carries only classes and the core's `data-*` state hooks — vow's base look (`@vow/theme`) targets these (the trigger and root are `display: contents`, so they impose no box; the panel is `position: fixed` at the cursor).

| Hook                         | Where                      | Means                                            |
| ---------------------------- | -------------------------- | ------------------------------------------------ |
| `.vow-context-menu`          | the wrapper `<div>`        | the root (carries the state hook; no box)        |
| `.vow-context-menu__trigger` | the trigger `<div>`        | wraps the slotted content + the handler          |
| `.vow-context-menu__panel`   | the `<div role=menu>`      | the floating panel (under `v-if`, at the cursor) |
| `.vow-context-menu__item`    | a `<button role=menuitem>` | one action                                       |
| `[data-state]`               | the root + panel           | `open` / `closed`                                |
| `[data-active]`              | the highlighted item       | the keyboard highlight                           |

## a11y, proven once

The core proves its own accessibility framework-free: the part-props are spread onto a vanilla `role="menu"`, then `axe` runs (0 violations) and a real **ArrowDown** moves the active item / **Enter** commits it. Because every adapter merely forwards those props, the app never re-tests a11y — see [a11y is tested against the platform](/guide/primitives#a11y-is-tested-against-the-platform-not-a-framework).

## Where it appears

Any generated app can put a `<ContextMenu>` over a board card, a table row, or a list item for its per-item actions — the actions that don't earn a permanent button. The menu is summoned by right-click, so it adds no chrome to the resting view.
