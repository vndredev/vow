import { mapOutsideFences } from "./fences.ts";

/** The callout kinds we support — same set VitePress offers. */
const KINDS = new Set(["tip", "info", "warning", "danger"]);
const OPEN = /^::: *(\w+) *(.*)$/;
const CLOSE = /^::: *$/;

/**
 * Convert `::: warning Title … :::` blocks into `<Callout kind="warning" title="Title">…</Callout>`,
 * keeping blank lines around the tags so the inner content is still rendered as markdown. Code fences
 * are skipped, and a `:::` whose word isn't a known kind is left as plain text. Flat (non-nested) — all
 * the docs use.
 */
export function transformContainers(src: string): string {
  return mapOutsideFences(src, (text) => {
    const out: string[] = [];
    let open = false;
    for (const line of text.split("\n")) {
      const match = open ? null : OPEN.exec(line);
      if (match && KINDS.has(match[1] ?? "")) {
        const kind = match[1] ?? "";
        const title = (match[2] ?? "").trim();
        const titleAttr = title.length > 0 ? ` title=${JSON.stringify(title)}` : "";
        out.push(`<Callout kind=${JSON.stringify(kind)}${titleAttr}>`, "");
        open = true;
      } else if (open && CLOSE.test(line)) {
        out.push("", "</Callout>");
        open = false;
      } else {
        out.push(line);
      }
    }
    if (open) out.push("", "</Callout>");
    return out.join("\n");
  });
}
