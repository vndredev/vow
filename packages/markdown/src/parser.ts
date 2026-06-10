import MarkdownIt from "markdown-it";
import { NONE } from "./maybe.ts";
import type { Tok } from "./types.ts";
import container from "markdown-it-container";

/** The `:::` container kinds: callouts, code-group (a tab switcher), and demo (a live primitive). */
const CONTAINERS = ["tip", "info", "warning", "danger", "code-group", "demo", "timeline"];

/** The shared markdown-it instance, with every `:::` container kind registered. */
const md = new MarkdownIt({ html: false, linkify: true });

/*
 * Register each `:::` container kind. This package pins the same `@types/markdown-it` as
 * `@types/markdown-it-container`, so the plugin's `(md, name, opts)` call type-checks directly. `md` is
 * module-level (never a function parameter), so it stays clear of the readonly-parameter rule.
 */
for (const name of CONTAINERS) {
  container(md, name, {});
}

/** One raw markdown-it token (a mutable class from the parser; never passed around directly). */
type RawTok = ReturnType<typeof md.parse>[number];

/**
 * Map raw tokens (and, recursively, their inline children) to the read-only `Tok` view, normalizing
 * `null` to absence. markdown-it's `Token` is an external, inherently mutable class read here only; a
 * `for` loop (not `.map`) keeps `no-array-callback-reference` satisfied without exposing a raw token.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- markdown-it's Token is an external, inherently mutable class; `toToks` only reads it.
function toToks(raws: readonly RawTok[]): Tok[] {
  const out: Tok[] = [];
  for (const raw of raws) {
    out.push({
      attrGet: (name) => raw.attrGet(name) ?? NONE,
      children: toToks(raw.children ?? []),
      content: raw.content,
      hidden: raw.hidden,
      info: raw.info,
      tag: raw.tag,
      type: raw.type,
    });
  }
  return out;
}

/** Parse markdown source into the read-only token view the renderer consumes. */
export function parse(source: string): readonly Tok[] {
  return toToks(md.parse(source, {}));
}
