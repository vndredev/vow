/**
 * @vow/shell — the app-chrome layer for generated vow apps (the sibling of @vow/docs, which is the
 * docs-chrome layer). It ships hand-written `.vue` chrome (a dashboard shell: a sidebar nav + a content
 * area, a mobile drawer) that composes vow's own primitives + @vow/theme tokens. The generated
 * `vow-app.layout.vue` imports `shell.vue` + `style.css` and passes the routed pages — the shell is a
 * swappable layer, like the theme.
 */

import type { NavSection, Page } from "./types.ts";
import { defined } from "@vow/core";

export { emitDarkToggleSfc } from "./dark-toggle.ts";
export type { NavSection, Page } from "./types.ts";

const byOrder = (first: Page, second: Page): number =>
  (first.order ?? 0) - (second.order ?? 0) || first.title.localeCompare(second.title);

/** A section's effective order — the lowest `order` among its items, so a group leads on its own `order`. */
function sectionOrder(items: readonly Page[]): number {
  return Math.min(...items.map((item) => item.order ?? 0));
}

function grouped(pages: readonly Page[]): readonly NavSection[] {
  const byGroup = new Map<string, readonly Page[]>();
  for (const page of pages) {
    const { group } = page;
    if (defined(group)) {
      byGroup.set(group, [...(byGroup.get(group) ?? []), page]);
    }
  }
  const entries: readonly (readonly [string, readonly Page[]])[] = [...byGroup.entries()];
  return entries.map(([title, items]): NavSection => ({ items: items.toSorted(byOrder), title }));
}

/**
 * Build the sidebar sections from the pages — Home + the ungrouped pages form one headerless section,
 * then each `group:` (a surface) is its own titled section. Sections are sorted by their effective
 * `order` (the lowest `order` among their items), so a group whose items declare a lower `order` than
 * Home leads the sidebar; ties keep the headerless section first, then `grouped` insertion order.
 * Mirrors @vow/docs' `buildSidebar`; a pure function, so the grouping is tested without a mount.
 */
export function buildNav(pages: readonly Page[]): readonly NavSection[] {
  const ungrouped = pages.filter((page) => !defined(page.group)).toSorted(byOrder);
  const flat: readonly Page[] = [{ icon: "home", path: "/", title: "Home" }, ...ungrouped];
  const sections: readonly NavSection[] = [{ items: flat }, ...grouped(pages)];
  return sections
    .map((section, index): readonly [NavSection, number] => [section, index])
    .toSorted(
      ([first, firstIndex], [second, secondIndex]) =>
        sectionOrder(first.items) - sectionOrder(second.items) || firstIndex - secondIndex,
    )
    .map(([section]) => section);
}
