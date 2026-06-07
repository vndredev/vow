import MarkdownIt from "markdown-it";
import { transformContainers } from "./containers.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { getHighlighter, highlight } from "./highlight.ts";
import { hoistBlocks } from "./hoist.ts";
import { transformSnippets } from "./snippet.ts";
import { tocPlugin, type TocEntry } from "./toc.ts";

export interface CompileOptions {
  /** Resolve a `<<< path` snippet (relative to the page) to its text — the caller tracks the dep. */
  readonly readSnippet?: (path: string) => string;
}

export interface CompiledPage {
  /** The page as a Vue SFC string — its body is a template, so embedded components work. */
  readonly code: string;
  /** The page's YAML frontmatter. */
  readonly data: Record<string, unknown>;
  /** The page's h2/h3 outline. */
  readonly toc: readonly TocEntry[];
}

/**
 * Compile a markdown string into a Vue SFC. The pipeline: split frontmatter → hoist the author's
 * `<script>`/`<style>` → inline `<<<` snippets → convert `:::` callouts → render to HTML (markdown-it +
 * Shiki, with h2/h3 ids + a collected TOC) → wrap the body in a `.vow-doc` template and re-attach the
 * hoisted blocks at the SFC top level. Every pre-pass skips fenced code, so samples are never rewritten.
 */
export async function compile(md: string, options: CompileOptions = {}): Promise<CompiledPage> {
  const { data, body } = splitFrontmatter(md);
  const { body: dehoisted, blocks } = hoistBlocks(body);
  const withSnippets = options.readSnippet
    ? transformSnippets(dehoisted, options.readSnippet)
    : dehoisted;
  const withCallouts = transformContainers(withSnippets);

  const highlighter = await getHighlighter();
  const toc: TocEntry[] = [];
  const renderer = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: (code, lang) => highlight(highlighter, code, lang),
  });
  tocPlugin(renderer, toc);
  const htmlBody = renderer.render(withCallouts);

  const head = blocks.length > 0 ? `${blocks.join("\n\n")}\n\n` : "";
  const code = `${head}<template>\n  <div class="vow-doc">\n${htmlBody}</div>\n</template>\n`;
  return { code, data, toc };
}
