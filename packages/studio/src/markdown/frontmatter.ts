import { parse as parseYaml } from "yaml";

/** YAML frontmatter at the very top of a file: `---\n…\n---`. Same shape vow.md uses. */
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;

export interface Frontmatter {
  /** The parsed YAML header (empty object when there is none). */
  readonly data: Record<string, unknown>;
  /** The markdown body below the frontmatter. */
  readonly body: string;
}

/** Split a markdown file into its YAML frontmatter (if any) and the body below it. */
export function splitFrontmatter(md: string): Frontmatter {
  const match = FRONTMATTER.exec(md);
  if (!match) return { data: {}, body: md };
  const parsed = parseYaml(match[1] ?? "") as unknown;
  const data =
    parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  return { data, body: md.slice(match[0].length) };
}
