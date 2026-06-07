import type MarkdownIt from "markdown-it";

export interface TocEntry {
  /** Heading level: 2 or 3. */
  readonly level: number;
  /** The heading's text. */
  readonly text: string;
  /** The id slug (also the anchor target). */
  readonly slug: string;
}

/** A url-safe slug from heading text: lowercase, non-alphanumerics collapse to single dashes. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A markdown-it plugin: give every `h2`/`h3` a stable id slug (so it's an anchor target) and collect
 * the headings into `toc` for the page's right-rail outline.
 */
export function tocPlugin(md: MarkdownIt, toc: TocEntry[]): void {
  const original = md.renderer.rules.heading_open;
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const level = token ? Number(token.tag.slice(1)) : 0;
    if (token && (level === 2 || level === 3)) {
      const text = tokens[idx + 1]?.content ?? "";
      const slug = slugify(text);
      token.attrSet("id", slug);
      toc.push({ level, text, slug });
    }
    return original
      ? original(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };
}
