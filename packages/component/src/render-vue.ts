import type { Attr, Component, ImportDecl, UiNode } from "./model.ts";

/**
 * The Vue adapter — render a canonical `Component` into a Vue SFC string. The first of many adapters
 * (React/Solid later render the same model differently). Output is **byte-stable**: pinned by an
 * equality test against the hand-written emitter output, so a render change is a red test, not a
 * silent drift.
 */

const INDENT = "  ";

/** HTML void elements — rendered self-closing (`<input … />`), never as an open/close pair. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** `& < >` escaping for literal text nodes — exactly matching the emitters' escapeHtml. */
const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Vue modifier suffix: `.prevent`, `.number`, … in array order. */
const renderModifiers = (mods?: readonly string[]): string =>
  (mods ?? []).map((m) => `.${m}`).join("");

/** Render one attribute in Vue syntax. */
function renderAttr(attr: Attr): string {
  switch (attr.kind) {
    case "static":
      return `${attr.name}="${attr.value}"`;
    case "bound":
      return `:${attr.name}="${attr.expr}"`;
    case "spread":
      return `v-bind="${attr.expr}"`;
    case "event":
      return `@${attr.name}${renderModifiers(attr.modifiers)}="${attr.expr}"`;
    case "model":
      return `v-model${renderModifiers(attr.modifiers)}="${attr.expr}"`;
    default: {
      const _exhaustive: never = attr;
      return _exhaustive;
    }
  }
}

/** Attrs as a leading-space-prefixed string, in array order (no sorting). */
const renderAttrs = (attrs: readonly Attr[]): string =>
  attrs.map((a) => ` ${renderAttr(a)}`).join("");

/** Render a UiNode at the given indent depth (in INDENT units). Inline if all children are text/interp. */
function renderNode(node: UiNode, depth: number): string {
  const pad = INDENT.repeat(depth);
  switch (node.kind) {
    case "text":
      return pad + escapeHtml(node.text);
    case "interp":
      return `${pad}{{ ${node.expr} }}`;
    case "element":
    case "component": {
      const open = node.kind === "component" ? node.name : node.tag;
      const attrs = renderAttrs(node.attrs);
      // HTML void elements are self-closing: <input … />
      if (node.kind === "element" && VOID_ELEMENTS.has(node.tag)) {
        return `${pad}<${open}${attrs} />`;
      }
      const tag = `<${open}${attrs}>`;
      // inline (no indent) if every child is text/interp; one child per line otherwise
      if (node.children.every((c) => c.kind === "text" || c.kind === "interp")) {
        const inner = node.children.map((c) => renderNode(c, 0)).join("");
        return `${pad}${tag}${inner}</${open}>`;
      }
      const inner = node.children.map((c) => renderNode(c, depth + 1)).join("\n");
      return `${pad}${tag}\n${inner}\n${pad}</${open}>`;
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

/** Render one import: a default binding, named bindings, or both. */
function renderImport(i: ImportDecl): string {
  const parts: string[] = [];
  if (i.default !== undefined) parts.push(i.default);
  if (i.names && i.names.length > 0) parts.push(`{ ${i.names.join(", ")} }`);
  return `import ${parts.join(", ")} from "${i.from}";`;
}

/** The `<script setup>` body lines — head (doc+imports), declarations (props+emits), setup; a blank line between non-empty sections. */
function renderScript(c: Component): string[] {
  const head: string[] = [
    ...(c.doc ?? []).map((d) => `// ${d}`),
    ...(c.imports ?? []).map(renderImport),
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
