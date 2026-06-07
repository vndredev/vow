import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { splitFrontmatter } from "./markdown/frontmatter.ts";
import { routes, type Route } from "./routes.ts";
import type { Page } from "./sidebar.ts";

/** List markdown files under `contentDir`, as posix paths relative to it, sorted. Skips dotfiles. */
export function listMarkdown(contentDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".md")) found.push(relative(contentDir, full).split("\\").join("/"));
    }
  };
  walk(contentDir);
  return found.sort();
}

/** Read a page's sidebar metadata from its frontmatter (title falls back to the first H1, then path). */
export function readPage(contentDir: string, route: Route): Page {
  const { data, body } = splitFrontmatter(readFileSync(join(contentDir, route.file), "utf8"));
  const title =
    typeof data["title"] === "string"
      ? data["title"]
      : (/^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? route.path);
  const group = typeof data["group"] === "string" ? data["group"] : "";
  const order = typeof data["order"] === "number" ? data["order"] : 0;
  return { file: route.file, path: route.path, title, group, order };
}

export interface Discovered {
  readonly routes: readonly Route[];
  readonly pages: readonly Page[];
}

/** Discover the content tree: the route table + each page's sidebar metadata. */
export function discover(contentDir: string): Discovered {
  const table = routes(listMarkdown(contentDir));
  return { routes: table, pages: table.map((route) => readPage(contentDir, route)) };
}
