/**
 * Small DOM helpers shared by the docs chrome's overlay components (search + mobile sidebar). Each
 * traps focus on open and restores it on close, so they share the "what is focused right now?" read.
 * `document.activeElement` and `HTMLElement` are platform DOM types — inherently mutable, so the
 * `prefer-readonly-parameter-types` rule is suppressed on the few parameters typed against them.
 */

/** A callback run against a captured HTMLElement. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM type, inherently mutable.
type ElementUse = (element: HTMLElement) => void;

/** Run `use` against the currently focused element when it is a focusable HTMLElement (else nothing). */
export function withFocusedElement(use: ElementUse): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement) {
    use(el);
  }
}
