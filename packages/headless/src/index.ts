/**
 * vow's headless primitives — framework-agnostic UI logic (our own "Zag", scoped to what we need).
 *
 * Each primitive is a pure function: it takes the current state + a setter and returns the DOM props
 * (ARIA attributes + event handlers) for each part. Framework adapters (Vue, React) only bind their
 * reactivity and spread the props — the logic lives here, once, for every framework.
 *
 * We build a primitive ONLY where HTML can't do it natively. A `<button>` is already accessible, so
 * there's no Button here — but a custom-styled checkbox needs role/aria/keyboard wiring, so it earns one.
 */

export interface CheckboxState {
  readonly checked: boolean;
  readonly disabled?: boolean;
}

export interface CheckboxApi {
  readonly checked: boolean;
  /** Props for the outer label/wrapper. */
  readonly rootProps: Record<string, unknown>;
  /** Props for the focusable control (the visible box). */
  readonly controlProps: Record<string, unknown>;
  /** Props for the text label. */
  readonly labelProps: Record<string, unknown>;
  toggle(): void;
}

/**
 * The checkbox primitive — WAI-ARIA APG conformant: `role="checkbox"`, `aria-checked`, **Space**
 * toggles (not Enter), `disabled` removes it from the tab order and blocks toggling.
 */
export function checkbox(state: CheckboxState, set: (next: CheckboxState) => void): CheckboxApi {
  const toggle = (): void => {
    if (state.disabled) return;
    set({ ...state, checked: !state.checked });
  };
  return {
    checked: state.checked,
    rootProps: {
      "data-checked": state.checked ? "" : undefined,
      "data-disabled": state.disabled ? "" : undefined,
    },
    controlProps: {
      role: "checkbox",
      "aria-checked": state.checked,
      "aria-disabled": state.disabled || undefined,
      tabindex: state.disabled ? -1 : 0,
      onClick: toggle,
      onKeydown: (event: KeyboardEvent): void => {
        if (event.key === " ") {
          event.preventDefault();
          toggle();
        }
      },
    },
    labelProps: { onClick: toggle },
    toggle,
  };
}
