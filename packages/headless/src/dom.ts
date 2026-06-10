/**
 * The sliver of DOM the keyboard handlers touch — kept type-safe (no casts). Roving-focus widgets (tabs,
 * radio-group) move focus to a sibling on an arrow key; they read the event's OWN subtree, so the logic is
 * provable against the platform. `instanceof` narrows `EventTarget` to `HTMLElement` without an assertion.
 *
 * Every narrowing happens inside these helpers, so callers never compare against `null`/`undefined`. The
 * DOM types (`EventTarget`, `HTMLElement`) are inherently mutable, so they can't be made deeply readonly —
 * the `prefer-readonly-parameter-types` rule is suppressed only on those platform-typed parameters.
 */

/** Move focus to the `index`-th element matching `selector` within `container`, if present. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM type, inherently mutable.
function focusMatch(container: HTMLElement, selector: string, index: number): void {
  const target = container.querySelectorAll<HTMLElement>(selector).item(index);
  if (target instanceof HTMLElement) {
    target.focus();
  }
}

/** Move focus to the `index`-th element matching `selector` within the keydown target's parent. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM type, inherently mutable.
export function focusSiblingFromTab(target: EventTarget | null, index: number): void {
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const list = target.parentElement;
  if (list instanceof HTMLElement) {
    focusMatch(list, '[role="tab"]', index);
  }
}

/** Move focus to the `index`-th radio within the keydown target's enclosing radiogroup. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM type, inherently mutable.
export function focusSiblingFromRadio(target: EventTarget | null, index: number): void {
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const group = target.closest<HTMLElement>('[role="radiogroup"]');
  if (group instanceof HTMLElement) {
    focusMatch(group, '[role="radio"]', index);
  }
}

/** A callback run against the narrowed target element. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM type, inherently mutable.
type ElementUse = (element: HTMLElement) => void;

/** Narrow an event target to its enclosing `HTMLElement`, then run `use` against it (else nothing). */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM type, inherently mutable.
export function withTargetElement(target: EventTarget | null, use: ElementUse): void {
  if (target instanceof HTMLElement) {
    use(target);
  }
}
