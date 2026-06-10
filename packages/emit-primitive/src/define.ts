import { renderVueSfc } from "@vow/component";

/**
 * The adapter-emitter seam — a typed factory that turns a canonical component into its SFC emitter.
 *
 * `primitive(component)` returns the `() => string` emitter the registry holds, while constraining the
 * literal's discriminants (`kind: "static"`, …) to the model's unions at the definition site. The shape
 * is derived from `renderVueSfc`'s own parameter, so each primitive group imports a single value and
 * never a type — satisfying both the type-specifier and duplicate-import rules in one move.
 */
type Component = Parameters<typeof renderVueSfc>[0];

export function primitive(component: Component): () => string {
  return (): string => renderVueSfc(component);
}
