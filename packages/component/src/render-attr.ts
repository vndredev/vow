import type { Attr, Loop } from "./model.ts";
import { assertAttrName } from "./validate-name.ts";
import { defined } from "./defined.ts";
import { escapeAttr } from "./escape.ts";

/** Vue modifier suffix: `.prevent`, `.number`, ... in array order. */
function renderModifiers(mods?: readonly string[]): string {
  return (mods ?? []).map((mod) => `.${mod}`).join("");
}

/** Render one attribute in Vue syntax. */
export function renderAttr(attr: Attr): string {
  switch (attr.kind) {
    case "static": {
      return `${attr.name}="${escapeAttr(attr.value)}"`;
    }
    case "bound": {
      assertAttrName(attr.name);
      return `:${attr.name}="${attr.expr}"`;
    }
    case "spread": {
      return `v-bind="${attr.expr}"`;
    }
    case "event": {
      return `@${attr.name}${renderModifiers(attr.modifiers)}="${attr.expr}"`;
    }
    case "model": {
      return `v-model${renderModifiers(attr.modifiers)}="${attr.expr}"`;
    }
    case "cond": {
      return `v-${attr.type}="${attr.expr}"`;
    }
    default: {
      const exhaustive: never = attr;
      return exhaustive;
    }
  }
}

/** Attrs as a leading-space-prefixed string, in array order (no sorting). */
export function renderAttrs(attrs: readonly Attr[]): string {
  return attrs.map((attr) => ` ${renderAttr(attr)}`).join("");
}

/** Render a `v-for` (+ optional `:key`) for a looped node. */
export function renderFor(loop: Loop): string {
  let binding = loop.as;
  if (defined(loop.index)) {
    binding = `(${loop.as}, ${loop.index})`;
  }
  let key = "";
  if (defined(loop.key)) {
    key = ` :key="${loop.key}"`;
  }
  return ` v-for="${binding} in ${loop.each}"${key}`;
}
