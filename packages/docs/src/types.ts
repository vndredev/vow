import type { TocEntry, getHighlighter } from "@vow/markdown";

export type { TocEntry } from "@vow/markdown";

/**
 * @vow/docs — reusable docs for any vow app. It scans a folder of plain `.md` content and generates a
 * prose `.vue` per file, rendered through the core (`@vow/markdown` → `emitProse`) — vow-native, not a
 * parallel doc-system. The content stays as markdown; the rendering is generated + dogfooded.
 */

/** A loaded Shiki highlighter (typed without a direct shiki import). */
export type Highlighter = Awaited<ReturnType<typeof getHighlighter>>;

/** A top-nav link. */
export interface NavLink {
  readonly text: string;
  readonly link: string;
}

/** The docs chrome config — title + top-nav links + the page base, surfaced in the generated manifest. */
export interface DocsConfig {
  readonly title: string;
  readonly nav: readonly NavLink[];
  /** The URL prefix doc pages live under (e.g. "/guide") — the layout uses it to tell docs from home. */
  readonly base: string;
}

export interface VowDocsOptions {
  /** Folder of plain `.md` content to render into prose pages. */
  readonly content: string;
  /** Where to write generated `.vue` (default ".generated", matching the vow app). */
  readonly outDir?: string;
  /** Section order for the sidebar (the page `group` frontmatter). Unlisted groups follow, A->Z. */
  readonly groups?: readonly string[];
  /** The site title shown in the top nav (links home). */
  readonly title?: string;
  /** Top-nav links. */
  readonly nav?: readonly NavLink[];
  /** A URL prefix for every page (e.g. "/guide"), so docs don't collide with the app's home. */
  readonly base?: string;
  /** One-line site summary for the generated `llms.txt` header. */
  readonly description?: string;
}

/** A page in the sidebar — its title, clean URL, and any nested child pages. */
export interface SidebarItem {
  readonly title: string;
  readonly path: string;
  readonly items?: readonly SidebarItem[];
}

/** A sidebar section — a `group` and its ordered pages. */
export interface SidebarGroup {
  readonly title: string;
  readonly items: readonly SidebarItem[];
}

/** A searchable entry — a page title or a heading (with its parent page for context). */
export interface SearchItem {
  readonly label: string;
  readonly path: string;
  readonly section?: string;
}

/**
 * Options threaded into generation. Every field is explicitly `| undefined` (not just optional) so the
 * plugin can pass a fully-built bag whose values are still maybe-absent, without per-key conditionals.
 */
export interface GenerateDocsOptions {
  readonly highlighter?: Highlighter | undefined;
  readonly groups?: readonly string[] | undefined;
  readonly title?: string | undefined;
  readonly nav?: readonly NavLink[] | undefined;
  readonly base?: string | undefined;
  /** One-line site summary for the `llms.txt` header. */
  readonly description?: string | undefined;
  /** Where to write `llms.txt` + `llms-full.txt` (the served `public/` dir). Skipped if unset. */
  readonly publicDir?: string | undefined;
}

/** One scanned page's metadata, before it becomes a route + a sidebar entry. */
export interface PageMeta {
  readonly path: string;
  readonly file: string;
  readonly group?: string;
  readonly order: number;
  readonly title: string;
}

/** One page's content, gathered during the scan for the llms.txt build. */
export interface LlmsEntry {
  readonly title: string;
  readonly path: string;
  readonly group?: string;
  readonly order: number;
  readonly body: string;
}

/** The site metadata threaded into the llms.txt header. */
export interface LlmsMeta {
  readonly title: string;
  readonly description?: string;
}

/** Both llms.txt artifacts: the curated `index` map and the single-file `full` dump. */
export interface LlmsFiles {
  readonly index: string;
  readonly full: string;
}

/** The settings threaded through a content scan — paths, the route base, and the pre-warmed highlighter. */
export interface ScanContext {
  readonly contentDir: string;
  readonly outDir: string;
  readonly base: string | undefined;
  readonly highlighter: Highlighter | undefined;
}

/** The routes, search index, llms entries, per-route TOC, written paths, and referenced component names. */
export interface ScanResult {
  readonly pages: readonly PageMeta[];
  readonly llmsEntries: readonly LlmsEntry[];
  readonly search: readonly SearchItem[];
  readonly tocByPath: Readonly<Record<string, readonly TocEntry[]>>;
  readonly written: readonly string[];
  /** The distinct `<Component>` names every page referenced (deduplicated across the scan). */
  readonly used: readonly string[];
}

/** One composed part a demo also materialises (e.g. a Card demo needs CardHeader + CardBody). */
export interface DemoPart {
  readonly emit: () => string;
  readonly name: string;
}

/** A live demo: its wrapper SFC + the generated primitive adapter it imports (`also` = extra parts a
 *  composed primitive needs, e.g. a Card demo materialises Card + CardHeader + CardBody). */
export interface Demo {
  readonly adapter: string;
  readonly also?: readonly DemoPart[];
  readonly emit: () => string;
  readonly sfc: string;
}
