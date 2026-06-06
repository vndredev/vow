import type { Attr, Component, TextNode, UiNode } from "./model.ts";

/**
 * The Vue adapter — render a canonical `Component` into a Vue SFC string. The first of many adapters
 * (React/Solid later render the same model differently). Output is **byte-stable**: pinned by an
 * equality test against the hand-written emitter output, so a render change is a red test, not a
 * silent drift.
 */

const INDENT = "  ";

/** `& < >` escaping for literal text nodes — exactly matching the emitters' escapeHtml. */
const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Render one attribute in Vue syntax. */
function renderAttr(attr: Attr): string {
  switch (attr.kind) {
    case "static":
      return `${attr.name}="${attr.value}"`;
    case "bound":
      return `:${attr.name}="${attr.expr}"`;
    case "spread":
      return `v-bind="${attr.expr}"`;
    default: {
      const _exhaustive: never = attr;
      return _exhaustive;
    }
  }
}

/** Attrs as a leading-space-prefixed string, in array order (no sorting). */
const renderAttrs = (attrs: readonly Attr[]): string =>
  attrs.map((a) => ` ${renderAttr(a)}`).join("");

/** A text node's inline content: interpolation if `expr`, else an escaped literal. */
const renderText = (node: TextNode): string =>
  node.expr !== undefined ? `{{ ${node.expr} }}` : escapeHtml(node.text ?? "");

/** Render a UiNode at the given indent depth (in INDENT units). Inline if all children are text. */
function renderNode(node: UiNode, depth: number): string {
  const pad = INDENT.repeat(depth);
  if (node.kind === "text") return pad + renderText(node);
  const open = node.kind === "component" ? node.name : node.tag;
  const tag = `<${open}${renderAttrs(node.attrs)}>`;
  if (node.children.every((c) => c.kind === "text")) {
    const inner = node.children.map((c) => (c.kind === "text" ? renderText(c) : "")).join("");
    return `${pad}${tag}${inner}</${open}>`;
  }
  const inner = node.children.map((c) => renderNode(c, depth + 1)).join("\n");
  return `${pad}${tag}\n${inner}\n${pad}</${open}>`;
}

/** The `<script setup>` body lines — head (doc+imports), declarations (props+emits), setup; a blank line between non-empty sections. */
function renderScript(c: Component): string[] {
  const head: string[] = [
    ...(c.doc ?? []).map((d) => `// ${d}`),
    ...(c.imports ?? []).map((i) => `import { ${i.names.join(", ")} } from "${i.from}";`),
  ];
  const decls: string[] = [];
  if (c.props && c.props.length > 0) {
    const fields = c.props.map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.tsType}`).join("; ");
    decls.push(`const props = defineProps<{ ${fields} }>();`);
  }
  if (c.events && c.events.length > 0) {
    const fields = c.events.map((e) => `${JSON.stringify(e.name)}: [${e.payload}]`).join("; ");
    decls.push(`const emit = defineEmits<{ ${fields} }>();`);
  }
  const sections = [head, decls, [...(c.setup ?? [])]].filter((s) => s.length > 0);
  return sections.flatMap((s, i) => (i === 0 ? s : ["", ...s]));
}

/** Render a canonical Component into a Vue SFC string (byte-stable). */
export function renderVueSfc(c: Component): string {
  return [
    `<script setup lang="ts">`,
    ...renderScript(c),
    `</script>`,
    ``,
    `<template>`,
    renderNode(c.view, 1),
    `</template>`,
    ``,
  ].join("\n");
}
