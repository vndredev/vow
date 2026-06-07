import MarkdownIt from "markdown-it";
import { splitFrontmatter } from "./frontmatter.ts";
import { getHighlighter, highlight } from "./highlight.ts";

export interface CompiledPage {
  /** The page as a Vue SFC string — its body is a template, so embedded components work later. */
  readonly code: string;
  /** The page's YAML frontmatter. */
  readonly data: Record<string, unknown>;
}

/**
 * Compile a markdown string into a Vue SFC. Frontmatter is split off; the body is rendered to HTML
 * (markdown-it) with fences highlighted by Shiki, then wrapped in a `.vow-doc` template. Embedded Vue
 * (components, interpolation) keeps working because the body is a Vue template. Containers, snippet
 * imports, a TOC, and `<script setup>` hoisting arrive in the next phase.
 */
export async function compile(md: string): Promise<CompiledPage> {
  const { data, body } = splitFrontmatter(md);
  const highlighter = await getHighlighter();
  const renderer = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: (code, lang) => highlight(highlighter, code, lang),
  });
  const htmlBody = renderer.render(body);
  const code = `<template>\n  <div class="vow-doc">\n${htmlBody}</div>\n</template>\n`;
  return { code, data };
}
