/** `& < >` escaping for literal text nodes — exactly matching the emitters' escapeHtml. */
export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
