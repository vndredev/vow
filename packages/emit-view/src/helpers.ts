import type { Attr, UiNode } from "@vow/component";

/**
 * The shared UiNode/Attr builders + raw-YAML coercions used across the view emitters. Small, pure,
 * adapter-neutral — every emitter composes its tree from these, so the node shapes stay in one place.
 */

/** A YAML scalar as a string (object/array values become empty — they aren't content). */
export function str(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/** A literal text node. */
export function txt(text: string): UiNode {
  return { kind: "text", text };
}

/** A bare element node with no attributes — the common wrapper case (`h1`, `p`, …). */
export function el(tag: string, children: readonly UiNode[]): UiNode {
  return { attrs: [], children: [...children], kind: "element", tag };
}

/** A component node by PascalCase name, with attrs + children. */
export function comp(name: string, attrs: readonly Attr[], children: readonly UiNode[]): UiNode {
  return { attrs: [...attrs], children: [...children], kind: "component", name };
}

/** A bound (`:name="expr"`) attribute. */
export function bound(name: string, expr: string): Attr {
  return { expr, kind: "bound", name };
}

/**
 * A raw string as a complete single-quoted JS literal, safe to embed inside a double-quoted Vue
 * `:attr="..."`. Escaping rides on `JSON.stringify` (backslashes, newlines, control chars); the
 * double-quoted JSON is then retargeted to a single-quoted literal. Every double quote becomes the
 * `&quot;` HTML entity so no bare double quote survives to break the surrounding attribute delimiter
 * (Vue decodes the entity back to a `"` before compiling the expression), and single quotes are
 * backslash-escaped for the literal. Includes the surrounding quotes — so callers embed it directly.
 */
export function quote(value: string): string {
  const json = JSON.stringify(value);
  const inner = json
    .slice(1, -1)
    .replaceAll(String.raw`\"`, "&quot;")
    .replaceAll("'", String.raw`\'`);
  return `'${inner}'`;
}

/**
 * A value as a JSON literal safe to embed inside a `<script setup>` body. `JSON.stringify` does not
 * escape the forward slash, so a string holding `</script>` would close the SFC's script block early
 * and let the rest run as markup (a stored-XSS sink for unconstrained values like select options).
 * Neutralizing every `</` to `<\/` (an equivalent JS string, never a closing tag) keeps the embed inert.
 */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("</", String.raw`<\/`);
}

/** One `key: value` entry of an object-literal expression — strings single-quoted, the rest via JSON. */
function entryExpr(entry: readonly [string, unknown]): string {
  const [key, value] = entry;
  if (typeof value === "string") {
    return `${key}: ${quote(value)}`;
  }
  return `${key}: ${JSON.stringify(value)}`;
}

/** A JS object-literal expression with single-quoted string values — safe inside a `:attr="..."`. */
export function objectExpr(obj: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(obj).map((entry: readonly [string, unknown]) => entryExpr(entry));
  return `{ ${entries.join(", ")} }`;
}
