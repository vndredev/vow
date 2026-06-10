import { checkedState, when } from "./attrs.ts";
import type { Props } from "./types.ts";

export interface SwitchState {
  readonly checked: boolean;
  readonly disabled?: boolean;
}

export interface SwitchApi {
  readonly checked: boolean;
  /** Props for the outer wrapper that groups control + label (carries the state hooks for theming). */
  readonly rootProps: Props;
  /** Props for the focusable control — a `<button role="switch">` (the track). */
  readonly controlProps: Props;
  /** Props for the sliding thumb part (shown via `data-state`, hidden from a11y). */
  readonly thumbProps: Props;
  /** Props for the text label. */
  readonly labelProps: Props;
  toggle(): void;
}

/**
 * The switch (toggle) primitive — a boolean with on/off semantics, WAI-ARIA APG conformant. HTML has no
 * stylable native switch, so it earns one: the control is a `<button role="switch">` carrying
 * `aria-checked`; **Space** and **Enter** toggle (both `preventDefault`ed so the native activation can't
 * fire a second toggle). `disabled` uses the native button `disabled`. State is mirrored onto each part
 * as `data-state="checked|unchecked"` / `data-disabled` for the theme to hook, never stored.
 *
 * The export keeps a trailing underscore: `switch` is a reserved word, and `switch_` is the contractual
 * name the generated adapter imports (`import { switch_ } from "@vow/headless"`).
 */
// oxlint-disable-next-line no-underscore-dangle
export function switch_(state: Readonly<SwitchState>, set: (next: SwitchState) => void): SwitchApi {
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
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggle();
        }
      },
      role: "switch",
      type: "button",
      ...when(disabled, { "data-disabled": "", disabled: true }),
    },
    labelProps: { onClick: toggle },
    rootProps: {
      "data-state": dataState,
      ...when(disabled, { "data-disabled": "" }),
    },
    thumbProps: {
      "aria-hidden": "true",
      "data-state": dataState,
    },
    toggle,
  };
}
