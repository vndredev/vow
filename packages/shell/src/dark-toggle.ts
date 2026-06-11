import { renderVueSfc } from "@vow/component";

/**
 * A backtick-delimited Vue expression for an aria attribute, e.g. `Theme: ${theme} — click to change`.
 * The `$` of the `theme` interpolation is written as the `$` escape so this source never holds a
 * literal `${` (the no-template-curly-in-string lint fires on that); the rendered output is the real Vue
 * interpolation. `${tail}` below is a true interpolation of this function's argument.
 */
function themeLabel(tail: string): string {
  return `\`Theme: \u0024{theme}${tail}\``;
}

/**
 * The dark-toggle chrome, described as a canonical `@vow/component` (not raw Vue) and rendered by the Vue
 * adapter — the first shell piece to go framework-neutral, so a React/Solid adapter renders the same tree.
 *
 * Presentation only: the tri-state logic + the shared theme state live in `use-theme.ts`. The button shows
 * the current theme's icon + label, and `cycle()` advances system to light to dark on click. `theme`/`icon`
 * are refs from `useTheme()` and auto-unwrap in the template. Carries only `class` hooks — the look is the
 * swappable `@vow/theme`. The rendered SFC is pinned byte-for-byte by a test (a render change is red, not
 * silent drift) and written to `dark-toggle.vue`, which the shell imports.
 */
const component: Parameters<typeof renderVueSfc>[0] = {
  doc: [
    "Generated dark-toggle chrome through @vow/component — do not edit. Logic lives in use-theme.ts.",
    "Carries class hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    { default: "Icon", from: "@vow/icons/Icon.vue" },
    { from: "./use-theme.ts", names: ["useTheme"] },
  ],
  name: "DarkToggle",
  setup: ["const { theme, icon, cycle } = useTheme();"],
  view: {
    attrs: [
      { kind: "static", name: "type", value: "button" },
      { kind: "static", name: "class", value: "vow-shell__theme" },
      { expr: themeLabel(""), kind: "bound", name: "aria-label" },
      { expr: themeLabel(" — click to change"), kind: "bound", name: "title" },
      { expr: "cycle", kind: "event", name: "click" },
    ],
    children: [
      {
        attrs: [{ expr: "icon", kind: "bound", name: "name" }],
        children: [],
        kind: "component",
        name: "Icon",
      },
      {
        attrs: [{ kind: "static", name: "class", value: "vow-shell__theme-label" }],
        children: [{ expr: "theme", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
    ],
    kind: "element",
    tag: "button",
  },
};

/** Render the dark-toggle SFC string from the canonical component (the Vue adapter). */
export function emitDarkToggleSfc(): string {
  return renderVueSfc(component);
}
