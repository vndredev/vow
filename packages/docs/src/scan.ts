import type {
  LlmsEntry,
  PageMeta,
  ScanContext,
  ScanResult,
  SearchItem,
  TocEntry,
} from "./types.ts";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Maybe, defined, mapDefined } from "@vow/core";
import { docSlug, firstH1, mdFilesUnder, parseFrontmatter, relNoExt, routePath } from "./paths.ts";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import type { UiNode } from "@vow/component";
import { emitProse } from "@vow/emit-view";
import { markdownToNodesSync } from "@vow/markdown";
import path from "node:path";

/** The single absence value for a `Maybe<T>` — read off an empty object's optional slot, no literal
 *  (the max lint wall forbids the `undefined` identifier). Mirrors @vow/markdown's same seam. */
const ABSENT: { readonly slot?: never } = {};
const NONE: Maybe<never> = ABSENT.slot;

/** A snippet resolver: read a `<<< <path>` include's content, or absent when it's out of bounds. */
type ResolveSnippet = (snippet: string) => Maybe<string>;

/** Read a file's content, or absent when it cannot be read — the read-side `Maybe` seam. */
function tryRead(full: string): Maybe<string> {
  try {
    return readFileSync(full, "utf8");
  } catch {
    return NONE;
  }
}

/** Every `<Component>` name referenced in a UiNode tree (structural — recurses into children). */
export function collectComponents(nodes: readonly UiNode[]): string[] {
  const names: string[] = [];
  for (const node of nodes) {
    if (node.kind === "component") {
      names.push(node.name);
    }
    if ("children" in node && Array.isArray(node.children)) {
      names.push(...collectComponents(node.children));
    }
  }
  return names;
}

/** Read a `<<< <path>` include, contained to the content tree — no absolute paths, no `../` escaping it. */
function makeResolveSnippet(contentDir: string, dir: string): ResolveSnippet {
  return (snippet) => {
    const full = path.resolve(dir, snippet);
    if (path.isAbsolute(snippet) || path.relative(contentDir, full).startsWith("..")) {
      return NONE;
    }
    return tryRead(full);
  };
}

/** The markdown options accepted by `markdownToNodesSync` (its second parameter). */
type MarkdownOptions = Parameters<typeof markdownToNodesSync>[1];

/** The markdown options for one page — the highlighter key is included only when one is present. The
 *  `toc` array is filled in place by the markdown renderer, so it stays a mutable sink. */
function markdownOptions(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries Shiki's `Highlighter`, a platform type.
  context: Readonly<ScanContext>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the markdown renderer fills `toc` in place.
  toc: TocEntry[],
  file: string,
): MarkdownOptions {
  const resolveSnippet = makeResolveSnippet(context.contentDir, path.dirname(file));
  if (defined(context.highlighter)) {
    return { highlighter: context.highlighter, resolveSnippet, toc };
  }
  return { resolveSnippet, toc };
}

/** Build a page's `group`-bearing piece, with the `group` key present only when set. */
function groupOf(group: string | undefined): { group?: string } {
  return mapDefined(group, (value) => ({ group: value })) ?? {};
}

/** The search entries for a page — its title plus one per heading (scoped by the page title). */
function searchEntries(title: string, route: string, toc: readonly TocEntry[]): SearchItem[] {
  return [
    { label: title, path: route },
    ...toc.map((heading) => ({
      label: heading.text,
      path: `${route}#${heading.slug}`,
      section: title,
    })),
  ];
}

/** One scanned page's results: the prose path written, its route metadata, search + llms entries. */
export interface ScannedPage {
  readonly out: string;
  readonly page: PageMeta;
  readonly llms: LlmsEntry;
  readonly toc: readonly TocEntry[];
  readonly search: readonly SearchItem[];
  readonly names: readonly string[];
}

/** A page's route metadata derived from its frontmatter + body — title, order, optional group. */
interface PageFacts {
  readonly title: string;
  readonly order: number;
  readonly group: { group?: string };
}

/** Derive a page's title (frontmatter, else first h1, else its route), order, and optional group. */
function pageFacts(data: Readonly<Record<string, string>>, body: string, route: string): PageFacts {
  return {
    group: groupOf(data["group"]),
    order: Number(data["order"] ?? 0),
    title: data["title"] ?? firstH1(body) ?? route,
  };
}

/** Scan one `.md` file into its prose `.vue` plus its route + search + llms metadata. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `context` carries Shiki's `Highlighter`, a platform type.
export function scanPage(file: string, context: Readonly<ScanContext>): ScannedPage {
  const slug = docSlug(context.contentDir, file);
  const route = routePath(relNoExt(context.contentDir, file), context.base);
  const { body, data } = parseFrontmatter(readFileSync(file, "utf8"));
  const toc: TocEntry[] = [];
  const nodes = markdownToNodesSync(body, markdownOptions(context, toc, file));
  const out = path.join(context.outDir, `${slug}.vue`);
  writeFileSync(out, emitProse(slug, nodes), "utf8");
  const { group, order, title } = pageFacts(data, body, route);
  return {
    llms: { body, order, path: route, title, ...group },
    names: collectComponents(nodes),
    out,
    page: { file: `${slug}.vue`, order, path: route, title, ...group },
    search: searchEntries(title, route, toc),
    toc,
  };
}

/** Throw when `values` has a duplicate — two content files collided on the same `noun`. */
function assertNoDuplicate(values: readonly string[], noun: (value: string) => string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`@vow/docs: two content files map to the same ${noun(value)}.`);
    }
    seen.add(value);
  }
}

/** Assemble the per-page results into the flat route/search/llms/TOC accumulators. */
function assemble(scanned: readonly ScannedPage[]): ScanResult {
  const tocByPath: Record<string, readonly TocEntry[]> = {};
  for (const page of scanned) {
    tocByPath[page.page.path] = page.toc;
  }
  return {
    llmsEntries: scanned.map((page) => page.llms),
    pages: scanned.map((page) => page.page),
    search: scanned.flatMap((page) => [...page.search]),
    tocByPath,
    used: [...new Set(scanned.flatMap((page) => [...page.names]))],
    written: scanned.map((page) => page.out),
  };
}

/** Whether a cached page is fresh for `mtimeMs` — re-scan (Shiki + write) only when the `.md`'s mtime
 *  moved. Pure, so the cache key (the mtime) is tested directly. */
export function cacheFresh(cachedMtimeMs: Maybe<number>, mtimeMs: number): boolean {
  return cachedMtimeMs === mtimeMs;
}

/** One cached page scan, keyed by the file's mtime. */
interface PageCacheEntry {
  readonly mtimeMs: number;
  readonly page: ScannedPage;
}
const pageCache = new Map<string, PageCacheEntry>();

/** `scanPage` cached by mtime — reuses the prior scan (skipping Shiki + the file write) when the `.md` is
 *  unchanged across HMR; only an edited file re-scans. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `context` carries Shiki's `Highlighter`, a platform type.
function cachedScanPage(file: string, context: Readonly<ScanContext>): ScannedPage {
  const { mtimeMs } = statSync(file);
  const entry = pageCache.get(file);
  if (defined(entry) && cacheFresh(entry.mtimeMs, mtimeMs)) {
    return entry.page;
  }
  const page = scanPage(file, context);
  pageCache.set(file, { mtimeMs, page });
  return page;
}

/** Scan every `.md` into a prose `.vue`, accumulating the routes, search index, and llms entries. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `context` carries Shiki's `Highlighter`, a platform type.
export function scanAll(context: Readonly<ScanContext>): ScanResult {
  const files = mdFilesUnder(context.contentDir);
  assertNoDuplicate(
    files.map((file) => docSlug(context.contentDir, file)),
    (slug) => `generated file "${slug}.vue"`,
  );
  const scanned = files.map((file) => cachedScanPage(file, context));
  assertNoDuplicate(
    scanned.map((page) => page.page.path),
    (route) => `route "${route}"`,
  );
  return assemble(scanned);
}
