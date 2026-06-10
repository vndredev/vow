import type { Maybe, ResolveSnippet } from "./types.ts";
import { defined } from "./maybe.ts";

/** A `<<< <path>` (optionally `{lang}`) line that includes a file as a fenced code block. */
const SNIPPET = /^<<<\s+(\S+?)(?:\{(\w+)\})?[ \t]*$/gmu;
const TRAILING_NEWLINE = /\n$/u;

/** The fenced code for one resolved snippet — the file content, or a "not found" marker block. */
function snippetBlock(path: string, lang: Maybe<string>, resolve: ResolveSnippet): string {
  const content = resolve(path);
  if (!defined(content)) {
    return `\`\`\`\n[snippet not found: ${path}]\n\`\`\``;
  }
  const lng = lang ?? path.split(".").pop() ?? "";
  return `\`\`\`${lng}\n${content.replace(TRAILING_NEWLINE, "")}\n\`\`\``;
}

/** Expand `<<< <path>` lines into fenced code blocks (read via `resolve`), before markdown-it. */
export function expandSnippets(src: string, resolve: ResolveSnippet): string {
  return src.replaceAll(SNIPPET, (_match, path: string, lang?: string) =>
    snippetBlock(path, lang, resolve),
  );
}
