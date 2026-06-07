export interface SidebarItem {
  readonly text: string;
  readonly link: string;
  /** Nested sub-pages (e.g. Primitives → Checkbox), present only when there are children. */
  readonly items?: readonly SidebarItem[];
}

export interface SidebarGroup {
  readonly text: string;
  readonly items: readonly SidebarItem[];
}

/** A page the sidebar places: its file (for nesting), URL, title, group, and sort order. */
export interface Page {
  readonly file: string;
  readonly path: string;
  readonly title: string;
  readonly group: string;
  readonly order: number;
}

/** The parent FILE of a page, by folder convention: `a/b/c.md` nests under `a/b.md`. Null at the root. */
function parentFile(file: string): string | null {
  const slash = file.lastIndexOf("/");
  return slash === -1 ? null : `${file.slice(0, slash)}.md`;
}

const byOrder = (a: Page, b: Page): number => a.order - b.order || a.path.localeCompare(b.path);

/**
 * Build a grouped, nested sidebar from pages + the group order. A page nests under the page whose file
 * matches its folder (`guide/primitives/checkbox.md` → child of `guide/primitives.md`); nested pages
 * are removed from their group's top level. Top-level pages are grouped by their `group` frontmatter,
 * groups appearing in `groupOrder`, pages sorted by `order` then path.
 */
export function buildSidebar(
  pages: readonly Page[],
  groupOrder: readonly string[],
): SidebarGroup[] {
  const byFile = new Map(pages.map((page) => [page.file, page]));
  const childrenOf = new Map<string, Page[]>();
  const tops: Page[] = [];
  for (const page of pages) {
    const pf = parentFile(page.file);
    const parent = pf !== null ? byFile.get(pf) : undefined;
    if (parent) {
      const kids = childrenOf.get(parent.file) ?? [];
      kids.push(page);
      childrenOf.set(parent.file, kids);
    } else {
      tops.push(page);
    }
  }

  const toItem = (page: Page): SidebarItem => {
    const kids = childrenOf.get(page.file);
    if (!kids || kids.length === 0) return { text: page.title, link: page.path };
    return { text: page.title, link: page.path, items: [...kids].sort(byOrder).map(toItem) };
  };

  const groups: SidebarGroup[] = [];
  for (const group of groupOrder) {
    const items = tops
      .filter((page) => page.group === group)
      .sort(byOrder)
      .map(toItem);
    if (items.length > 0) groups.push({ text: group, items });
  }
  return groups;
}
