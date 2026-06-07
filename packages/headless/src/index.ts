/**
 * vow's headless primitives — framework-agnostic UI logic (our own "Zag/Reka", scoped to what we need).
 *
 * Each primitive is a pure function: it takes the current state + a setter and returns the DOM props
 * (ARIA attributes + event handlers + `data-*` state hooks) for each part. Framework adapters (Vue,
 * React) only bind their reactivity and spread the props — the logic lives here, once, for every
 * framework. vow then dresses the parts with its own base look (`@vow/theme`), targeting the hooks.
 *
 * We build a primitive ONLY where HTML can't do it natively. A `<button>` is already accessible, so
 * there's no Button here — but a custom checkbox needs role/aria/keyboard/state wiring, so it earns
 * one. Modelled on Reka UI: the control is a `<button role="checkbox">`, state is exposed as
 * `data-state="checked|unchecked"` (+ `data-disabled`), and a separate indicator part shows the mark.
 */

export interface CheckboxState {
  readonly checked: boolean;
  readonly disabled?: boolean;
}

export interface CheckboxApi {
  readonly checked: boolean;
  /** Props for the outer wrapper that groups control + label (carries the state hooks for theming). */
  readonly rootProps: Record<string, unknown>;
  /** Props for the focusable control — a `<button role="checkbox">`. */
  readonly controlProps: Record<string, unknown>;
  /** Props for the indicator part (the visible mark); shown via `data-state`, hidden from a11y. */
  readonly indicatorProps: Record<string, unknown>;
  /** Props for the text label. */
  readonly labelProps: Record<string, unknown>;
  toggle(): void;
}

/**
 * The checkbox primitive — WAI-ARIA APG conformant, Reka-style. The control is a `<button>` carrying
 * `role="checkbox"` + `aria-checked`; **Space** toggles, **Enter** does not (a checkbox never toggles
 * on Enter), and we `preventDefault` both keys so the native button activation can't fire a second
 * toggle. `disabled` uses the native button `disabled` (out of the tab order, inert). State is mirrored
 * onto each part as `data-state` / `data-disabled` for the theme to hook, never stored anywhere.
 */
export function checkbox(state: CheckboxState, set: (next: CheckboxState) => void): CheckboxApi {
  const dataState = state.checked ? "checked" : "unchecked";
  const toggle = (): void => {
    if (state.disabled) return;
    set({ ...state, checked: !state.checked });
  };
  return {
    checked: state.checked,
    rootProps: {
      "data-state": dataState,
      "data-disabled": state.disabled ? "" : undefined,
    },
    controlProps: {
      type: "button",
      role: "checkbox",
      "aria-checked": state.checked,
      "data-state": dataState,
      "data-disabled": state.disabled ? "" : undefined,
      disabled: state.disabled || undefined,
      onClick: toggle,
      onKeydown: (event: KeyboardEvent): void => {
        if (event.key === " ") {
          event.preventDefault();
          toggle();
        } else if (event.key === "Enter") {
          event.preventDefault();
        }
      },
    },
    indicatorProps: {
      "data-state": dataState,
      "aria-hidden": "true",
    },
    labelProps: { onClick: toggle },
    toggle,
  };
}
