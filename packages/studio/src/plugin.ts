import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import type { StudioConfig } from "./config.ts";
import { discover } from "./discover.ts";
import { compile } from "./markdown/compile.ts";
import { buildSidebar } from "./sidebar.ts";
import { loadVirtual, resolveVirtual } from "./virtual.ts";

export interface StudioOptions {
  /** The content root, relative to the Vite root (default "."). */
  readonly contentDir?: string;
  /** The site config (title, nav, sidebar group order). */
  readonly config: StudioConfig;
}

/** Compile a markdown module to a Vue SFC string; `<<<` snippets read relative to the page. */
export async function compileMarkdownModule(code: string, id: string): Promise<string> {
  const dir = dirname(id);
  const { code: sfc } = await compile(code, {
    readSnippet: (rel) => readFileSync(resolve(dir, rel), "utf8"),
  });
  return sfc;
}

/**
 * The studio Vite plugin. As an `enforce: "pre"` step it turns each `.md` into a Vue SFC string (the
 * host's `vue()` must `include` `.md` so it then compiles it), and serves the `virtual:vow-studio/*`
 * modules (routes, sidebar, config) the app shell imports. In dev it watches the content tree and full-
 * reloads when pages are added/removed (per-page edits hot-update through the module graph).
 */
export function studioDocs(options: StudioOptions): Plugin {
  let contentDir = "";
  return {
    name: "vow:studio",
    enforce: "pre",
    configResolved(config) {
      contentDir = resolve(config.root, options.contentDir ?? ".");
    },
    resolveId(id) {
      return resolveVirtual(id);
    },
    load(id) {
      if (!id.startsWith("\0virtual:vow-studio/")) return undefined;
      const { routes, pages } = discover(contentDir);
      const sidebar = buildSidebar(pages, options.config.sidebarGroups ?? []);
      return loadVirtual(id, { routes, sidebar, config: options.config, contentDir });
    },
    async transform(code, id) {
      if (!id.endsWith(".md")) return undefined;
      this.addWatchFile(id);
      return { code: await compileMarkdownModule(code, id), map: null };
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      const reload = (file: string): void => {
        if (!file.endsWith(".md")) return;
        // a page added/removed changes the route + sidebar tables — rebuild via a full reload.
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    },
  };
}
