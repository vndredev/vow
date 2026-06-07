/** A fenced code block: 3+ backticks or tildes, its info string, body, and matching closing fence. */
const FENCE = /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)/g;

/**
 * Apply `fn` to the parts of `src` that lie OUTSIDE fenced code blocks, leaving the fences untouched.
 * Every markdown pre-pass (script/style hoisting, containers, snippet imports) runs through this so it
 * never rewrites a code *sample* that happens to show `:::`, `<<<`, or `<script>`.
 */
export function mapOutsideFences(src: string, fn: (text: string) => string): string {
  let out = "";
  let last = 0;
  FENCE.lastIndex = 0;
  for (let m = FENCE.exec(src); m !== null; m = FENCE.exec(src)) {
    out += fn(src.slice(last, m.index));
    out += m[0];
    last = m.index + m[0].length;
  }
  out += fn(src.slice(last));
  return out;
}
