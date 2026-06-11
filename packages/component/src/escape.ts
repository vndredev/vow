/** `& < >` escaping for literal text nodes — exactly matching the emitters' escapeHtml. */
export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Attribute-value escaping: `escapeHtml` plus the `"` that delimits a `name="value"` attribute. */
export function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
