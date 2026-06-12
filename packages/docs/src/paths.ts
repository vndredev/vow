import { defined } from "@vow/core";
import path from "node:path";
import { readdirSync } from "node:fs";

/** Recursively collect every `.md` file under a directory, sorted (deterministic, FS-order-independent). */
export function mdFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...mdFilesUnder(full));
    } else if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out.toSorted();
}

/** A leading YAML frontmatter block (flat `key: value` lines) split from the markdown body. */
export interface Frontmatter {
  readonly data: Record<string, string>;
  readonly body: string;
}

/** Split a leading YAML frontmatter block (flat `key: value` lines) from the markdown body. */
export function parseFrontmatter(src: string): Frontmatter {
  const match = /^---\n([\s\S]*?)\n---\n?/u.exec(src);
  if (!match) {
    return { body: src, data: {} };
  }
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? "").split("\n")) {
    const [, key, value] = /^(\w+):\s*(.+)$/u.exec(line.trim()) ?? [];
    if (defined(key) && defined(value)) {
      data[key] = value.trim();
    }
  }
  return { body: src.slice(match[0].length), data };
}

/** The first `# heading` of a markdown body — the page title fallback. */
export const firstH1 = (body: string): string | undefined =>
  // Strip fenced code (``` or ~~~) first, so a `# comment` inside a code block isn't taken as the title
  /^#\s+(.+)$/mu.exec(body.replaceAll(/(```|~~~)[\s\S]*?\1/gu, ""))?.[1]?.trim();

/** A content file's path under the root, `.md` stripped, forward-slashed (e.g. "guide/emit"). */
export const relNoExt = (contentDir: string, file: string): string =>
  path.relative(contentDir, file).replace(/\.md$/u, "").replaceAll("\\", "/");

/** A content file's generated slug — its path with `/` → `-`, `doc-` prefixed. */
export const docSlug = (contentDir: string, file: string): string =>
  `doc-${relNoExt(contentDir, file).replaceAll("/", "-")}`;

/** A content file's clean URL under `base` — `index` collapses to its folder ("guide/index" → "/guide"). */
export const routePath = (rel: string, base = ""): string => {
  const cleaned = rel.replace(/(^|\/)index$/u, "$1").replace(/\/$/u, "");
  const segments = [base, cleaned].flatMap((segment) => segment.split("/")).filter(Boolean);
  return `/${segments.join("/")}`;
};
