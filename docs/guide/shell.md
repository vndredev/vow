---
group: UI
order: 1
---

# App shell

The shell is the frame around your pages: a left **sidebar** (brand + page nav) and a centered **content column**. The router wraps every routed page in it — you write nothing. Below 960px the sidebar collapses into a hamburger **drawer**.

It lives in `@vow/shell`, the app-chrome layer — a hand-written `.vue` frame built from vow's own primitives and theme tokens. Like the [theme](/guide/architecture), it's a swappable layer; it shares only _logic_ with the docs chrome (`@vow/docs`), the headless `dialog`, never the components. See [Architecture](/guide/architecture) for where it sits.

## How it's wired

You write nothing. When an app has more than its home page, the plugin generates a thin `vow-app.layout.vue` that imports `@vow/shell`'s `Shell.vue`, passes the routed **pages** + the current **path** + the app **title**, and the boot globs it as the layout for every route:

```ts
// vite.config.ts — set the brand
vow({ title: "Task planner" });
```

The sidebar nav is **data-driven** from the routed pages (`Home` + every non-root view/form), active-marked by the path. No nav to hand-maintain — add a page (a view or a `## form`), and it appears.

## The container model

The shell **owns the page width**: pages render inside one centered content column (`--vow-container-3`). A `## view` (`.vow-app`) or a `## form` (`.vow-form`) just stacks its blocks and fills that column — it never re-centers or sets its own page padding. One centering zone, not three.

## Dark mode

The sidebar footer carries a **tri-state theme toggle** — it cycles `system → light → dark`. An explicit choice persists in `localStorage`; `system` follows the OS live. To avoid a flash, the app's `index.html` sets the class before first paint:

```html
<script>
  (() => {
    const s = localStorage.getItem("vow-theme");
    if (s ? s === "dark" : matchMedia("(prefers-color-scheme: dark)").matches)
      document.documentElement.classList.add("dark");
  })();
</script>
```

The theme is just the `.dark` class on `<html>` — `@vow/theme`'s tokens have a `.dark` block, so the whole UI re-skins from one place. (Same logic as the docs chrome; shared by convention, not code.)

## Mobile

Below 960px the sidebar is hidden and a top **bar** appears with a hamburger. Tapping it opens the same sidebar as a left **drawer** — built on vow's own [`dialog`](/guide/primitives/dialog) primitive, so it gets **Esc**, a focus-trap and an overlay-click dismiss from the framework-free core; it also closes after you navigate. The nav content (`SidebarNav`) is one component, rendered in both the desktop sidebar and the drawer, so they never diverge.

## Extend it (don't fork it)

`Shell.vue` is built for extension:

- **Slots** — `#sidebar-footer` (extra sidebar content, above the dark toggle) and `#topbar-actions` (the mobile bar's right side) augment the chrome without forking it.
- **`variant`** — the prop reserves a seam: `sidebar` today, `top` (a top-nav shell) drops in later without a rewrite.
- **Swappable** — replace `@vow/shell` wholesale for a different app frame, exactly as you'd swap the theme.

## Styling hooks

The shell carries only classes (built on theme tokens), so re-skinning is the tokens:

| Hook                                                   | Where                                                  |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `.vow-shell`                                           | the `sidebar \| main` grid                             |
| `.vow-shell__sidebar` · `__brand` · `__nav` · `__link` | the sidebar + its nav (active = the accent guide-line) |
| `.vow-shell__main` · `__content`                       | the main column (the centered content)                 |
| `.vow-shell__bar` · `__burger`                         | the mobile top bar + its hamburger (< 960px)           |
| `.vow-shell-drawer` · `__overlay` · `__panel`          | the mobile nav drawer (the sidebar in a `dialog`)      |
