import type { IconName } from "@vow/icons";

/** One navigable page in the shell's sidebar nav — declared per view/form in its `nav:` frontmatter. */
export interface Page {
  /** A surface (group header) to nest this link under; ungrouped links sit with Home. */
  readonly group?: string;
  /** A @vow/icons glyph shown before the label. */
  readonly icon?: IconName;
  /** Sort order within Home/ungrouped, or within the group. */
  readonly order?: number;
  readonly path: string;
  readonly title: string;
}

/** A sidebar section — the headerless Home/ungrouped group (no title), or a named surface. */
export interface NavSection {
  readonly items: readonly Page[];
  readonly title?: string;
}
