import { createHighlighter, type Highlighter } from "shiki";

/** The languages fences actually use. Unknown languages fall back to plain text, never an error. */
const LANGS = ["ts", "js", "tsx", "jsx", "vue", "bash", "json", "yaml", "md", "html", "css"];

/** Dual theme: Shiki emits both, switched downstream by a `.dark` class — no re-highlight. */
const THEMES = { light: "github-light", dark: "github-dark" } as const;

let instance: Highlighter | null = null;

/** The shared Shiki highlighter, created once (async: it loads grammars + themes). */
export async function getHighlighter(): Promise<Highlighter> {
  instance ??= await createHighlighter({ themes: Object.values(THEMES), langs: LANGS });
  return instance;
}

/**
 * Highlight code to dual-theme HTML. `defaultColor: false` emits per-theme CSS vars (so the theme
 * drives both modes and the block background is a card, not Shiki's white). The `<pre>` is marked
 * `v-pre` so an adapter never interprets `{{ … }}` inside a code sample.
 */
export function highlight(hl: Highlighter, code: string, lang: string): string {
  // A `vue` snippet without an SFC block (`<template>` / `<script>`) is a bare template fragment — the
  // vue grammar only colours the outermost tag, so highlight it as `html` (every tag gets coloured).
  const effective = lang === "vue" && !/<(template|script)[\s>]/.test(code) ? "html" : lang;
  const known = hl.getLoadedLanguages().includes(effective);
  return hl.codeToHtml(code, {
    lang: known ? effective : "text",
    themes: THEMES,
    defaultColor: false,
    transformers: [
      {
        pre(node) {
          node.properties["v-pre"] = "";
        },
      },
    ],
  });
}
