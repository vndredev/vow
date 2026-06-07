import { mapOutsideFences } from "./fences.ts";

/** A snippet import line: `<<< path` or `<<< path{lang}` — inlines a file as a fenced code block. */
const SNIPPET = /^<<< *(\S+?)(?:\{(\w+)\})? *$/;

/**
 * Replace `<<< path{lang}` lines with a fenced code block of the file's contents, so the import shows
 * the *real* file (drift-proof). `read` resolves the path (relative to the page) to text — the caller
 * injects it and tracks the file as a dependency for HMR. Skips lines inside code fences.
 */
export function transformSnippets(src: string, read: (path: string) => string): string {
  return mapOutsideFences(src, (text) =>
    text
      .split("\n")
      .map((line) => {
        const match = SNIPPET.exec(line);
        if (!match) return line;
        const path = match[1] ?? "";
        const lang = match[2] ?? "";
        return `\`\`\`${lang}\n${read(path)}\n\`\`\``;
      })
      .join("\n"),
  );
}
