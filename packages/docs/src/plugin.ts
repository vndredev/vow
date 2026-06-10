import type { GenerateDocsOptions, Highlighter, VowDocsOptions } from "./types.ts";
import type { Plugin } from "vite-plus";
import { generateDocs } from "./generate.ts";
import { getHighlighter } from "@vow/markdown";
import path from "node:path";

/** A caught value reduced to its message + stack — narrows `unknown` without an unsafe cast. */
interface ErrorInfo {
  readonly message: string;
  readonly stack: string;
}

/** Reduce a caught `unknown` to a message + stack (a non-Error throw degrades to its string form). */
function errorInfo(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? "" };
  }
  return { message: String(error), stack: "" };
}

/** The plugin's resolved paths + pre-warmed highlighter, filled in `configResolved`. */
interface DocsState {
  contentDir: string;
  genDir: string;
  publicDir: string;
  highlighter?: Highlighter;
}

/** Absolute `candidate` as-is, else resolved against `root`. */
function absolute(root: string, candidate: string): string {
  if (path.isAbsolute(candidate)) {
    return candidate;
  }
  return path.join(root, candidate);
}

/** The served `public/` dir — the resolved config value, or the default folder under `root` when unset. */
function resolvePublicDir(root: string, configured: string): string {
  if (configured === "") {
    return path.join(root, "public");
  }
  return configured;
}

/** The generation options for a run — built from the static plugin options plus the resolved state. */
function runOptions(
  options: Readonly<VowDocsOptions>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `state` carries Shiki's `Highlighter`, a platform type.
  state: Readonly<DocsState>,
): GenerateDocsOptions {
  return {
    base: options.base,
    description: options.description,
    groups: options.groups,
    highlighter: state.highlighter,
    nav: options.nav,
    publicDir: state.publicDir,
    title: options.title,
  };
}

/** A Vite plugin: scan `content` into generated prose pages; pre-warm Shiki once; reload on `.md` edit. */
export function vowDocs(options: Readonly<VowDocsOptions>): Plugin {
  const outOpt = options.outDir ?? ".generated";
  const state: DocsState = {
    contentDir: options.content,
    genDir: outOpt,
    publicDir: "",
  };
  const regenerate = (): void => {
    generateDocs(state.contentDir, state.genDir, runOptions(options, state));
  };
  return {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Vite's resolved config, inherently mutable.
    async configResolved(config) {
      state.contentDir = absolute(config.root, options.content);
      state.genDir = absolute(config.root, outOpt);
      state.publicDir = resolvePublicDir(config.root, config.publicDir);
      // Pre-warm once, so generation stays sync
      state.highlighter = await getHighlighter();
      try {
        regenerate();
      } catch (error) {
        config.logger.error(`[vow:docs] generation failed: ${errorInfo(error).message}`);
      }
    },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Vite's dev server, inherently mutable.
    configureServer(server) {
      server.watcher.add(state.contentDir);
      const onChange = (file: string): void => {
        if (file.startsWith(state.contentDir) && file.endsWith(".md")) {
          try {
            regenerate();
            server.ws.send({ type: "full-reload" });
          } catch (error) {
            // A bad save mid-edit must NOT crash the dev server — show it in the Vite error overlay and
            // Keep serving the last good docs; the next valid save clears it.
            const info = errorInfo(error);
            server.config.logger.error(`[vow:docs] generation failed: ${info.message}`);
            server.ws.send({ err: info, type: "error" });
          }
        }
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
    name: "vow:docs",
  };
}
