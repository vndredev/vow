import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import type { Plugin } from "vite-plus";
import { emitProse } from "@vow/emit-view";
import { getHighlighter, markdownToNodesSync } from "@vow/markdown";

/**
 * @vow/docs — reusable docs for any vow app. It scans a folder of plain `.md` content and generates a
 * prose `.vue` per file, rendered through the core (`@vow/markdown` → `emitProse`) — vow-native, not a
 * parallel doc-system. The content stays as markdown; the rendering is generated + dogfooded.
 */

/** A loaded Shiki highlighter (typed without a direct shiki import). */
type Highlighter = Awaited<ReturnType<typeof getHighlighter>>;

export interface VowDocsOptions {
  /** Folder of plain `.md` content to render into prose pages. */
  readonly content: string;
  /** Where to write generated `.vue` (default ".generated", matching the vow app). */
  readonly outDir?: string;
}

/** Recursively collect every `.md` file under a directory. */
function mdFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...mdFilesUnder(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/** Strip a leading YAML frontmatter block — the prose body is what renders. */
const stripFrontmatter = (src: string): string => src.replace(/^---\n[\s\S]*?\n---\n?/, "");

/** A content file's generated slug — its path under the root, `/` → `-`, `doc-` prefixed. */
export const docSlug = (contentDir: string, file: string): string =>
  `doc-${relative(contentDir, file).replace(/\.md$/, "").replace(/[/\\]/g, "-")}`;

/**
 * Scan a content folder → a generated prose `.vue` per `.md`. Returns the written paths. With a
 * highlighter, fenced code is Shiki-highlighted; without (e.g. tests), it is a plain `<pre>`.
 */
export function generateDocs(contentDir: string, outDir: string, hl?: Highlighter): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const file of mdFilesUnder(contentDir)) {
    const slug = docSlug(contentDir, file);
    const nodes = markdownToNodesSync(stripFrontmatter(readFileSync(file, "utf8")), hl);
    const out = join(outDir, `${slug}.vue`);
    writeFileSync(out, emitProse(slug, nodes), "utf8");
    written.push(out);
  }
  return written;
}

/** A Vite plugin: scan `content` into generated prose pages; pre-warm Shiki once; reload on `.md` edit. */
export function vowDocs(options: VowDocsOptions): Plugin {
  const outOpt = options.outDir ?? ".generated";
  let contentDir = options.content;
  let genDir = outOpt;
  let highlighter: Highlighter | undefined;
  const regenerate = (): void => {
    generateDocs(contentDir, genDir, highlighter);
  };
  return {
    name: "vow:docs",
    async configResolved(config) {
      contentDir = isAbsolute(options.content)
        ? options.content
        : join(config.root, options.content);
      genDir = isAbsolute(outOpt) ? outOpt : join(config.root, outOpt);
      highlighter = await getHighlighter(); // pre-warm once, so generation stays sync
      regenerate();
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      const onChange = (file: string): void => {
        if (file.startsWith(contentDir) && file.endsWith(".md")) {
          regenerate();
          server.ws.send({ type: "full-reload" });
        }
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
