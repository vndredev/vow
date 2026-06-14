import { NONE, defined } from "@vow/core";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { Maybe } from "./types.ts";
import path from "node:path";

/**
 * The docs reader — serves the same `docs/guide/*.md` the site renders (`@vow/docs` scans that same
 * folder), so an agent driving `@vow/mcp` over stdio reads the docs through the front door it already
 * uses to operate the studio. Self-contained (no upward import into the UI-layer `@vow/docs`): it
 * mirrors that folder's flat `key: value` frontmatter + recursive `.md` walk in a few server-side lines.
 *
 * A page's SLUG is its path under `docs/guide` with `.md` stripped, forward-slashed — exactly the site's
 * route tail (e.g. `mcp`, `primitives/button`). `list_docs` enumerates every page; `read_docs` returns
 * one page's raw markdown by slug; `search_docs` ranks pages by a query over title + body.
 */

const MD = ".md";
const EXCERPT_RADIUS = 80;
const NO_MATCH = -1;

/** The first `# heading` of a markdown body — a page's title, with fenced code stripped so a `#` inside
 *  a code block is never mistaken for it. Absent when the body has no top-level heading. */
function firstHeading(body: string): Maybe<string> {
  const stripped = body.replaceAll(/(```|~~~)[\s\S]*?\1/gu, "");
  const match = /^#\s+(.+)$/mu.exec(stripped);
  return match?.[1]?.trim();
}

/** A page's `group` frontmatter (the sidebar bucket the site renders it under), or absent when unset. */
function frontmatterGroup(src: string): Maybe<string> {
  const block = /^---\n([\s\S]*?)\n---/u.exec(src)?.[1] ?? "";
  return /^group:\s*(.+)$/mu.exec(block)?.[1]?.trim();
}

/** A doc page as `list_docs` exposes it — its slug, title (first `# heading`), and sidebar group. */
export interface DocPage {
  readonly group: string;
  readonly slug: string;
  readonly title: string;
}

/** The full text of one doc page — its slug plus the raw markdown the site renders. */
export interface DocContent {
  readonly markdown: string;
  readonly slug: string;
}

/** One ranked `search_docs` hit — a page plus a short excerpt around the first match. */
export interface DocHit {
  readonly excerpt: string;
  readonly group: string;
  readonly slug: string;
  readonly title: string;
}

/** Recursively collect every `.md` file under a directory, sorted (deterministic, FS-order-independent). */
function mdFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...mdFilesUnder(full));
    } else if (entry.name.endsWith(MD)) {
      out.push(full);
    }
  }
  return out.toSorted();
}

/** A `.md` file's slug under the guide root — its path with `.md` stripped, forward-slashed. */
function slugOf(guideDir: string, file: string): string {
  return path.relative(guideDir, file).slice(0, -MD.length).replaceAll(path.sep, "/");
}

/** Whether `dir` holds a `docs/guide` folder — the marker the upward walk stops on. */
function hasGuide(dir: string): boolean {
  const guide = path.join(dir, "docs", "guide");
  return existsSync(guide) && statSync(guide).isDirectory();
}

/**
 * The `docs/guide` directory, found by walking up from `appDir` (the studio's app dir) to the repo root —
 * so the reader works from a worktree, a starter, or the repo root alike. Absent when no ancestor holds a
 * `docs/guide` folder (e.g. a generated app shipped without the vow docs), so the tools degrade to "no
 * docs found" rather than throw.
 */
export function findGuideDir(appDir: string): Maybe<string> {
  let dir = path.resolve(appDir);
  for (;;) {
    if (hasGuide(dir)) {
      return path.join(dir, "docs", "guide");
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return NONE;
    }
    dir = parent;
  }
}

/** One page's slug · title · group, read from its `.md` source. */
function pageOf(guideDir: string, file: string): DocPage {
  const src = readFileSync(file, "utf8");
  const slug = slugOf(guideDir, file);
  return { group: frontmatterGroup(src) ?? "", slug, title: firstHeading(src) ?? slug };
}

/** Every doc page (slug · title · group), sorted by slug — empty when no `docs/guide` is found. */
export function listDocs(appDir: string): readonly DocPage[] {
  const guideDir = findGuideDir(appDir);
  if (!defined(guideDir)) {
    return [];
  }
  return mdFilesUnder(guideDir).map((file) => pageOf(guideDir, file));
}

/** A slug with a trailing `.md` stripped (so `mcp` and `mcp.md` resolve to one page). */
function bareSlug(slug: string): string {
  if (slug.endsWith(MD)) {
    return slug.slice(0, -MD.length);
  }
  return slug;
}

/** Resolve a page file under the guide root from a slug, guarding against path traversal — absent when the
 *  slug names no page (or escapes the guide dir). The slug is matched with or without a trailing `.md`. */
function pageFile(guideDir: string, slug: string): Maybe<string> {
  const file = path.resolve(guideDir, bareSlug(slug) + MD);
  const within = file === guideDir || file.startsWith(guideDir + path.sep);
  if (within && existsSync(file) && statSync(file).isFile()) {
    return file;
  }
  return NONE;
}

/** One page's raw markdown by slug — absent when no `docs/guide` is found or the slug names no page. */
export function readDoc(appDir: string, slug: string): Maybe<DocContent> {
  const guideDir = findGuideDir(appDir);
  if (!defined(guideDir)) {
    return NONE;
  }
  const file = pageFile(guideDir, slug);
  if (!defined(file)) {
    return NONE;
  }
  return { markdown: readFileSync(file, "utf8"), slug: slugOf(guideDir, file) };
}

/** A short excerpt of `body` around the first case-insensitive hit of `query` — empty when no hit. */
function excerptAround(body: string, query: string): string {
  const at = body.toLowerCase().indexOf(query.toLowerCase());
  if (at === NO_MATCH) {
    return "";
  }
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(body.length, at + query.length + EXCERPT_RADIUS);
  return body.slice(start, end).replaceAll(/\s+/gu, " ").trim();
}

/** A page's `search_docs` hit when its title or body contains `term` (case-insensitive) — absent otherwise. */
function hitOf(guideDir: string, file: string, term: string): Maybe<DocHit> {
  const src = readFileSync(file, "utf8");
  const slug = slugOf(guideDir, file);
  const title = firstHeading(src) ?? slug;
  const needle = term.toLowerCase();
  if (!src.toLowerCase().includes(needle) && !title.toLowerCase().includes(needle)) {
    return NONE;
  }
  return { excerpt: excerptAround(src, term), group: frontmatterGroup(src) ?? "", slug, title };
}

/** A maybe-absent hit as a list — `[hit]` when set, `[]` when absent (a flat-map filter, no ternary). */
function asList(hit: Maybe<DocHit>): readonly DocHit[] {
  if (defined(hit)) {
    return [hit];
  }
  return [];
}

/** Pages whose title or body contains `query` (case-insensitive), each with a short excerpt around the
 *  first body hit — empty when the query is blank or no `docs/guide` is found. */
export function searchDocs(appDir: string, query: string): readonly DocHit[] {
  const term = query.trim();
  const guideDir = findGuideDir(appDir);
  if (term === "" || !defined(guideDir)) {
    return [];
  }
  return mdFilesUnder(guideDir).flatMap((file) => asList(hitOf(guideDir, file, term)));
}
