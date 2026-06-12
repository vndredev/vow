/* oxlint-disable consistent-type-specifier-style -- one import; the wrapped specifiers trip no-duplicate-imports if split */
import {
  type ButtonContext,
  type ButtonIntent,
  buttonContextDefault,
  resolveButton,
} from "@vow/theme";
/* oxlint-enable consistent-type-specifier-style */
import type { Attr } from "./types.ts";

/**
 * The emit-time bridge from the design language's INTENTS to a button's `data-*` axes. The author (or an
 * emitter) names an intent or a context; the design language (`@vow/theme`) owns the resolution to
 * variant·tone·size — so a button's look is consistent by construction, never raw axes per call.
 */

/** The static variant·tone·size attrs a button intent resolves to. */
export function intentAttrs(intent: ButtonIntent): Attr[] {
  const { size, tone, variant } = resolveButton(intent);
  return [
    { kind: "static", name: "variant", value: variant },
    { kind: "static", name: "tone", value: tone },
    { kind: "static", name: "size", value: size },
  ];
}

/** A button's attrs from its CONTEXT — the design language's context-default intent (a row's actions cell →
 *  `row`, a form footer → `primary`), so the author writes only the deviation; the look follows the place. */
export function contextAttrs(context: ButtonContext): Attr[] {
  return intentAttrs(buttonContextDefault(context));
}
