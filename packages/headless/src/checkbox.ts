import { checkedState, when } from "./attrs.ts";
import type { Props } from "./types.ts";

export interface CheckboxState {
  readonly checked: boolean;
  readonly disabled?: boolean;
}

export interface CheckboxApi {
  readonly checked: boolean;
  /** Props for the outer wrapper that groups control + label (carries the state hooks for theming). */
  readonly rootProps: Props;
  /** Props for the focusable control — a `<button role="checkbox">`. */
  readonly controlProps: Props;
  /** Props for the indicator part (the visible mark); shown via `data-state`, hidden from a11y. */
  readonly indicatorProps: Props;
  /** Props for the text label. */
  readonly labelProps: Props;
  toggle(): void;
}

/**
 * The checkbox primitive — WAI-ARIA APG conformant. The control is a `<button>` carrying
 * `role="checkbox"` + `aria-checked`; **Space** toggles, **Enter** does not (a checkbox never toggles
 * on Enter), and we `preventDefault` both keys so the native button activation can't fire a second
 * toggle. `disabled` uses the native button `disabled` (out of the tab order, inert). State is mirrored
 * onto each part as `data-state` / `data-disabled` for the theme to hook, never stored anywhere.
 */
export function checkbox(
  state: Readonly<CheckboxState>,
  set: (next: CheckboxState) => void,
): CheckboxApi {
  const dataState = checkedState(state.checked);
  const disabled = state.disabled ?? false;
  const toggle = (): void => {
    if (disabled) {
      return;
    }
    set({ ...state, checked: !state.checked });
  };
  return {
    checked: state.checked,
    controlProps: {
      "aria-checked": state.checked,
      "data-state": dataState,
      onClick: toggle,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event types are inherently mutable; they can't be made deeply readonly.
      onKeydown: (event: KeyboardEvent): void => {
        if (event.key === " ") {
          event.preventDefault();
          toggle();
        } else if (event.key === "Enter") {
          event.preventDefault();
        }
      },
      role: "checkbox",
      type: "button",
      ...when(disabled, { "data-disabled": "", disabled: true }),
    },
    indicatorProps: {
      "aria-hidden": "true",
      "data-state": dataState,
    },
    labelProps: { onClick: toggle },
    rootProps: {
      "data-state": dataState,
      ...when(disabled, { "data-disabled": "" }),
    },
    toggle,
  };
}
