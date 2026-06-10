import type { Maybe, ResolveSnippet, TocEntry } from "./types.ts";
import type { UiNode } from "@vow/component";
import { blockToNodes } from "./block.ts";
import { defined } from "./maybe.ts";
import { expandSnippets } from "./snippet.ts";
import { getHighlighter } from "./highlight.ts";
import { parse } from "./parser.ts";

export { getHighlighter, highlight } from "./highlight.ts";
export type { TocEntry } from "./types.ts";

/** A loaded Shiki highlighter — derived from `getHighlighter`, so `shiki` is never imported as a type. */
type Highlighter = Awaited<ReturnType<typeof getHighlighter>>;

/** Options for the sync render path. */
export interface MarkdownOptions {
  /** A pre-warmed Shiki highlighter (else fenced code is a plain `<pre>`). */
  readonly highlighter?: Maybe<Highlighter>;
  /** Read a `<<< <path>` snippet's content (relative to the source file); absent = not found. */
  readonly resolveSnippet?: Maybe<ResolveSnippet>;
  /** If given, the page's h2/h3 headings are collected here (the "on this page" TOC). */
  readonly toc?: Maybe<TocEntry[]>;
}

/** The source with `<<< <path>` includes expanded (when a resolver is given), else the source verbatim. */
function expanded(source: string, resolve: Maybe<ResolveSnippet>): string {
  if (defined(resolve)) {
    return expandSnippets(source, resolve);
  }
  return source;
}

/**
 * Render markdown to vow's UiNode model with an already-loaded highlighter — the sync path the
 * generator uses (Shiki is pre-warmed once). Without a highlighter, fenced code is a plain `<pre>`;
 * `resolveSnippet` enables `<<< <path>` file includes.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `opts.toc` is the caller's output array by API contract (the "on this page" entries are appended into it).
export function markdownToNodesSync(source: string, opts: MarkdownOptions = {}): UiNode[] {
  const src = expanded(source, opts.resolveSnippet);
  return blockToNodes(parse(src), opts.highlighter, opts.toc);
}

/**
 * Render markdown to vow's UiNode model — the reusable prose engine. Headings/paragraphs/lists/inline
 * map to element + text nodes; fenced code becomes a raw, Shiki-highlighted node (the escape hatch).
 * Adapter-neutral: a React/Solid adapter renders the same nodes. Async because Shiki loads grammars.
 */
export async function markdownToNodes(source: string): Promise<UiNode[]> {
  const highlighter = await getHighlighter();
  return markdownToNodesSync(source, { highlighter });
}
