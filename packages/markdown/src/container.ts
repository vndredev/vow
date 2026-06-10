import { bound, comp, el, raw, sattr, txt } from "./node.ts";
import type { Frame } from "./types.ts";
import type { UiNode } from "@vow/component";
import { highlight } from "./highlight.ts";

/** A loaded Shiki highlighter (read-only) — derived from `highlight`'s first param (imported once). */
type Highlighter = Parameters<typeof highlight>[0];

const WORD_BOUNDARY = /(^|[-_\s])(\w)/gu;
const TRAILING_NEWLINE = /\n$/u;
const FIRST_WORD = /\s+/u;
const LABEL = /\[([^\]]+)\]/u;
const APOSTROPHE = /'/gu;

/** PascalCase a word (`checkbox` → `Checkbox`, `code-group` → `CodeGroup`). */
const pascal = (word: string): string =>
  word.replaceAll(WORD_BOUNDARY, (_match, _sep: string, char: string) => char.toUpperCase());

/** A `:::` callout container → a styled box with an optional title (code-group is handled inline). */
export function calloutNode(name: string, title: string, kids: readonly UiNode[]): UiNode {
  if (title) {
    const heading = el("p", [txt(title)], [sattr("class", "vow-callout__title")]);
    return el("div", [heading, ...kids], [sattr("class", "vow-callout"), sattr("data-kind", name)]);
  }
  return el("div", kids, [sattr("class", "vow-callout"), sattr("data-kind", name)]);
}

/** The `:labels` expression for a CodeGroup — a single-quoted array literal of the fence labels. */
function labelsExpr(labels: readonly string[]): string {
  const quoted = labels.map((label) => `'${label.replaceAll(APOSTROPHE, String.raw`\'`)}'`);
  return `[${quoted.join(", ")}]`;
}

/** Open the frame for a `:::` container, dispatched by its kind. */
export function openContainerFrame(name: string, info: string): Frame {
  if (name === "code-group") {
    return {
      build: (kids, labels) => comp("CodeGroup", [bound("labels", labelsExpr(labels))], kids),
      collectsLabels: true,
    };
  }
  if (name === "demo") {
    // `::: demo <primitive>` → a live demo component (@vow/docs generates it). No raw Vue.
    const demo = `VowDemo${pascal(info.trim().slice("demo".length).trim())}`;
    return { build: () => comp(demo, [], []) };
  }
  if (name === "timeline") {
    // `::: timeline` → the git-derived timeline (@vow/docs bakes the entries in). No hand-typed list.
    return { build: () => comp("VowTimeline", [], []) };
  }
  const title = info.trim().slice(name.length).trim();
  return { build: (kids) => calloutNode(name, title, kids) };
}

/** A fenced block → a raw Shiki node when a highlighter is given, else a plain `<pre><code>`. */
export function codeNode(content: string, info: string, hl?: Highlighter): UiNode {
  const code = content.replace(TRAILING_NEWLINE, "");
  if (!hl) {
    return el("pre", [el("code", [txt(code)])]);
  }
  const [lang = ""] = info.trim().split(FIRST_WORD);
  return raw(highlight(hl, code, lang));
}

/** The fence label inside a `::: code-group` (`[pnpm]`), or the first word of the info string. */
export function fenceLabel(info: string): string {
  return LABEL.exec(info)?.[1]?.trim() ?? info.trim().split(FIRST_WORD)[0] ?? "";
}
