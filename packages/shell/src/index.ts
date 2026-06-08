/**
 * @vow/shell — the app-chrome layer for generated vow apps (the sibling of @vow/docs, which is the
 * docs-chrome layer). It ships hand-written `.vue` chrome (a dashboard shell: a sidebar nav + a content
 * area, a mobile drawer) that composes vow's own primitives + @vow/theme tokens. The generated
 * `vow-app.layout.vue` imports `Shell.vue` + `style.css` and passes the routed pages — the shell is a
 * swappable layer, like the theme.
 */

import type { IconName } from "@vow/icons";

/** One navigable page in the shell's sidebar nav — declared per view/form in its `nav:` frontmatter. */
export interface Page {
  readonly path: string;
  readonly title: string;
  /** A @vow/icons glyph shown before the label. */
  readonly icon?: IconName;
  /** A surface (group header) to nest this link under; ungrouped links sit with Home. */
  readonly group?: string;
  /** Sort order within Home/ungrouped, or within the group. */
  readonly order?: number;
}

/** A sidebar section — the headerless Home/ungrouped group (no title), or a named surface. */
export interface NavSection {
  readonly title?: string;
  readonly items: readonly Page[];
}

const byOrder = (a: Page, b: Page): number =>
  (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title);

/**
 * Build the sidebar sections from the pages — Home + the ungrouped pages first (one headerless
 * section), then each `group:` (a surface) as its own titled section. Ordered by `order`, then title.
 * Mirrors @vow/docs' `buildSidebar`; a pure function, so the grouping is tested without a mount.
 */
export function buildNav(pages: readonly Page[]): NavSection[] {
  const flat: Page[] = [
    { path: "/", title: "Home", icon: "home" },
    ...pages.filter((p) => p.group === undefined).sort(byOrder),
  ];
  const byGroup = new Map<string, Page[]>();
  for (const p of pages) {
    if (p.group === undefined) continue;
    byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), p]);
  }
  const groups: NavSection[] = [...byGroup.entries()].map(([title, items]) => ({
    title,
    items: [...items].sort(byOrder),
  }));
  return [{ items: flat }, ...groups];
}
