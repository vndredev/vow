import { NONE, defined } from "./maybe.ts";
import type { Maybe } from "./types.ts";
import { createHighlighter } from "shiki";

/** The Shiki highlighter — derived from the factory so `highlight.ts` imports `shiki` once (a value). */
export type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;

/** A read-only view of the highlighter — the shape every consumer passes around as a parameter. */
export type ReadHighlighter = Readonly<Highlighter>;

/** The languages fences actually use. Unknown languages fall back to plain text, never an error. */
const LANGS = ["ts", "js", "tsx", "jsx", "vue", "bash", "json", "yaml", "md", "html", "css"];

/** Dual theme: Shiki emits both, switched downstream by a `.dark` class — no re-highlight. */
const THEMES = { dark: "github-dark", light: "github-light" } as const;

/** A bare `<template>` / `<script>` block — its presence marks a full SFC (vs. a fragment). */
const SFC_BLOCK = /<(template|script)[\s>]/u;

/** The one-shot memo for the shared highlighter — a holder so the lazy slot is set on declaration. */
const memo: { instance: Maybe<Highlighter> } = { instance: NONE };

/** The shared Shiki highlighter, created once (async: it loads grammars + themes). */
export async function getHighlighter(): Promise<Highlighter> {
  if (defined(memo.instance)) {
    return memo.instance;
  }
  const created = await createHighlighter({ langs: LANGS, themes: Object.values(THEMES) });
  memo.instance = created;
  return created;
}

/** A `vue` snippet without an SFC block is a bare template fragment — highlight it as `html`. */
function effectiveLang(lang: string, code: string): string {
  if (lang === "vue" && !SFC_BLOCK.test(code)) {
    return "html";
  }
  return lang;
}

/**
 * Highlight code to dual-theme HTML. `defaultColor: false` emits per-theme CSS vars (so the theme
 * drives both modes and the block background is a card, not Shiki's white). The `<pre>` is marked
 * `v-pre` so an adapter never interprets `{{ … }}` inside a code sample.
 */
export function highlight(hl: ReadHighlighter, code: string, lang: string): string {
  // The vue grammar only colours the outermost tag of a fragment, so a fragment is highlighted as html.
  const effective = effectiveLang(lang, code);
  const known = hl.getLoadedLanguages().includes(effective);
  let resolved = "text";
  if (known) {
    resolved = effective;
  }
  return hl.codeToHtml(code, {
    defaultColor: false,
    lang: resolved,
    themes: THEMES,
    transformers: [
      {
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Shiki's hast node is mutated by contract (the transformer API writes to it).
        pre(node) {
          node.properties["v-pre"] = "";
        },
      },
    ],
  });
}
