import type { PageMeta, SidebarGroup, SidebarItem } from "./types.ts";
import { defined } from "@vow/core";

/** Order pages by their `order`, then their title — the stable sort the sidebar + nesting share. */
function byOrderThenTitle(first: Readonly<PageMeta>, second: Readonly<PageMeta>): number {
  return first.order - second.order || first.title.localeCompare(second.title);
}

/** Group the pages by their `group` frontmatter (ungrouped pages, e.g. the home page, are dropped). */
function groupPages(pages: readonly PageMeta[]): Map<string, PageMeta[]> {
  const byGroup = new Map<string, PageMeta[]>();
  for (const page of pages) {
    if (defined(page.group)) {
      byGroup.set(page.group, [...(byGroup.get(page.group) ?? []), page]);
    }
  }
  return byGroup;
}

/** The section order — `groups` first (in order), then any extras A->Z. */
export function sectionOrder(
  keys: readonly string[],
  groups: readonly string[],
): readonly string[] {
  const extras = keys.filter((group) => !groups.includes(group)).toSorted();
  return [...groups, ...extras];
}

/** Whether `ancestor` is a strict path-prefix ancestor of `page` (e.g. `/g/a` of `/g/a/b/c`). */
function isAncestor(ancestor: Readonly<PageMeta>, page: Readonly<PageMeta>): boolean {
  return page.path.startsWith(`${ancestor.path}/`);
}

/** The deepest (longest-path) page in `pages` that is a strict ancestor of `page` — its parent, if any. */
function parentOf(
  page: Readonly<PageMeta>,
  pages: readonly PageMeta[],
): Readonly<PageMeta> | undefined {
  return pages
    .filter((other) => isAncestor(other, page))
    .toSorted((first, second) => second.path.length - first.path.length)
    .at(0);
}

/** Build one page's sidebar item, recursing into the pages whose nearest ancestor is this page. */
function toItem(page: Readonly<PageMeta>, pages: readonly PageMeta[]): SidebarItem {
  const children = pages
    .filter((candidate) => parentOf(candidate, pages)?.path === page.path)
    .toSorted(byOrderThenTitle)
    .map((child) => toItem(child, pages));
  if (children.length > 0) {
    return { items: children, path: page.path, title: page.title };
  }
  return { path: page.path, title: page.title };
}

/** Nest pages whose path is under another's, at any depth (e.g. `/guide/a/b/c` under `/guide/a/b`). */
export function nestItems(pages: readonly PageMeta[]): SidebarItem[] {
  return pages
    .filter((page) => !defined(parentOf(page, pages)))
    .toSorted(byOrderThenTitle)
    .map((page) => toItem(page, pages));
}

/** Group the pages into ordered sidebar sections — `groups` first (in order), then any extras A->Z. */
export function buildSidebar(
  pages: readonly PageMeta[],
  groups: readonly string[] = [],
): SidebarGroup[] {
  const byGroup = groupPages(pages);
  return sectionOrder([...byGroup.keys()], groups)
    .filter((group) => byGroup.has(group))
    .map((group) => ({ items: nestItems(byGroup.get(group) ?? []), title: group }));
}
