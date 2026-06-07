import { createHighlighter, type Highlighter } from "shiki";

/** The languages the docs actually use in fences. Unknown languages fall back to plain text. */
const LANGS = ["ts", "js", "tsx", "jsx", "vue", "bash", "json", "yaml", "md", "html", "css"];

/** Dual theme: Shiki emits both, switched by a CSS class (`.dark`) downstream — no re-highlight. */
const THEMES = { light: "github-light", dark: "github-dark" } as const;

let instance: Highlighter | null = null;

/** The shared Shiki highlighter, created once (async: it loads grammars + themes). */
export async function getHighlighter(): Promise<Highlighter> {
  instance ??= await createHighlighter({ themes: Object.values(THEMES), langs: LANGS });
  return instance;
}

/**
 * Highlight a fenced code block to dual-theme HTML. The `<pre>` is marked `v-pre` so Vue never tries
 * to interpret `{{ … }}` inside code samples. Unknown languages render as plain text, not an error.
 */
export function highlight(highlighter: Highlighter, code: string, lang: string): string {
  const known = highlighter.getLoadedLanguages().includes(lang);
  return highlighter.codeToHtml(code, {
    lang: known ? lang : "text",
    themes: THEMES,
    // Emit per-theme CSS vars (--shiki-light/-dark) for token colors instead of an inline default,
    // so the theme drives both modes and the block background is the theme's card (not Shiki's white).
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
