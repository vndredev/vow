import type { DocsConfig, PageMeta, SearchItem, SidebarGroup, TocEntry } from "./types.ts";

/** The two-space indent for the pretty-printed JSON literals embedded in the manifest. */
const INDENT = 2;

/** Everything the generated manifest module needs — routes, sidebar, config, per-page TOC, search. */
export interface ManifestInput {
  readonly pages: readonly PageMeta[];
  readonly sidebar: readonly SidebarGroup[];
  readonly config: DocsConfig;
  readonly tocByPath: Readonly<Record<string, readonly TocEntry[]>>;
  readonly search: readonly SearchItem[];
}

/** Pretty-print a value as a JSON literal (the identity replacer avoids the `undefined` argument). */
function pretty(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => inner, INDENT);
}

/** One page's route literal — `{ path, title, load: () => import(...) }`. */
function routeLine(page: Readonly<PageMeta>, siteTitle: string): string {
  const title = JSON.stringify(`${page.title} · ${siteTitle}`);
  return `  { path: ${JSON.stringify(page.path)}, title: ${title}, load: () => import("./${page.file}") },`;
}

/** The generated manifest — `@vow/docs`'s routes (boot) + sidebar + config + per-page TOC (the layout). */
export function manifestModule(input: Readonly<ManifestInput>): string {
  const { config, pages, search, sidebar, tocByPath } = input;
  return [
    `// Generated docs manifest (from @vow/docs). The markdown is the source — do not edit.`,
    `import type { Route } from "@vow/router";`,
    `import type { DocsConfig, SearchItem, SidebarGroup, TocEntry } from "@vow/docs";`,
    ``,
    `export const routes: Route[] = [`,
    ...pages.map((page) => routeLine(page, config.title)),
    `];`,
    ``,
    `export const sidebar: SidebarGroup[] = ${pretty(sidebar)};`,
    ``,
    `export const config: DocsConfig = ${pretty(config)};`,
    ``,
    `export const tocByPath: Record<string, TocEntry[]> = ${pretty(tocByPath)};`,
    ``,
    `export const search: SearchItem[] = ${pretty(search)};`,
    ``,
  ].join("\n");
}
