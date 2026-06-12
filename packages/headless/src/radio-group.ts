import { backwardIndex, checkedState, forwardIndex, rovingTabindex, when } from "./attrs.ts";
import type { Props } from "./types.ts";
import { focusSiblingFromRadio } from "./dom.ts";

export interface RadioGroupState {
  readonly value: string;
  readonly options: readonly string[];
  readonly disabled?: boolean;
}

export interface RadioGroupApi {
  readonly value: string;
  /** Props for the group wrapper — a `role="radiogroup"`. */
  readonly rootProps: Props;
  /** Per-option props (roving focus + selection) for the radio with this value. */
  radioProps(option: string): Props;
  select(option: string): void;
}

/** The target index for an arrow/Home/End key in a radio group (or the same index for any other key). */
function radioStep(key: string, index: number, length: number): number {
  if (key === "ArrowDown" || key === "ArrowRight") {
    return forwardIndex(index, length);
  }
  if (key === "ArrowUp" || key === "ArrowLeft") {
    return backwardIndex(index, length);
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return length - 1;
  }
  return index;
}

/**
 * The next option for an arrow/Home/End key (wraps both ways). Returns `current` unchanged for any other
 * key or an unknown current — the caller acts only when the value moves (no `undefined` sentinel).
 */
function nextRadioValue(key: string, current: string, options: readonly string[]): string {
  const index = options.indexOf(current);
  if (index === -1) {
    return current;
  }
  return options.at(radioStep(key, index, options.length)) ?? current;
}

/** The single tabbable radio: the checked option, or the first one when nothing is checked yet. */
function tabbableOption(options: readonly string[], value: string): string {
  if (options.includes(value)) {
    return value;
  }
  return options.at(0) ?? value;
}

/**
 * The radio-group primitive — WAI-ARIA APG. A `role="radiogroup"` of `role="radio"` buttons
 * with **roving focus**: only the checked option (or the first, if none) is tabbable (`tabindex` 0, the
 * rest -1); an Arrow key moves focus AND selects (APG radio behaviour), wrapping. State is mirrored as
 * `data-state="checked|unchecked"` / `data-disabled` for the theme, never stored.
 */
export function radioGroup(
  state: Readonly<RadioGroupState>,
  set: (next: RadioGroupState) => void,
): RadioGroupApi {
  const disabled = state.disabled ?? false;
  const select = (option: string): void => {
    if (!disabled && option !== state.value) {
      set({ ...state, value: option });
    }
  };
  // The tabbable option: the checked one, or the first when nothing is checked yet.
  const tabbable = tabbableOption(state.options, state.value);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
  const onRadioKeydown = (option: string, event: KeyboardEvent): void => {
    const next = nextRadioValue(event.key, option, state.options);
    if (next === option) {
      return;
    }
    event.preventDefault();
    select(next);
    focusSiblingFromRadio(event.currentTarget, state.options.indexOf(next));
  };
  return {
    radioProps(option) {
      const checked = option === state.value;
      return {
        "aria-checked": checked,
        "data-state": checkedState(checked),
        onClick: (): void => {
          select(option);
        },
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
        onKeydown: (event: KeyboardEvent): void => {
          onRadioKeydown(option, event);
        },
        role: "radio",
        tabindex: rovingTabindex(option === tabbable),
        type: "button",
        ...when(disabled, { "data-disabled": "", disabled: true }),
      };
    },
    rootProps: {
      role: "radiogroup",
      ...when(disabled, { "data-disabled": "" }),
    },
    select,
    value: state.value,
  };
}
