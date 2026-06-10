import { openState, when } from "./attrs.ts";
import type { Props } from "./types.ts";

export interface CollapsibleState {
  readonly open: boolean;
  /** A stable base id to wire the trigger and content (aria-controls / aria-labelledby). */
  readonly id: string;
  readonly disabled?: boolean;
}

export interface CollapsibleApi {
  readonly open: boolean;
  /** Props for the outer wrapper (carries the state hooks for theming). */
  readonly rootProps: Props;
  /** Props for the focusable trigger — a `<button>` that expands/collapses the region. */
  readonly triggerProps: Props;
  /** Props for the collapsible content region; the adapter renders it under `v-show="open"`. */
  readonly contentProps: Props;
  toggle(): void;
}

/**
 * The collapsible (disclosure) primitive — Reka-style. A `<button>` trigger toggles a content region;
 * the button is the whole keyboard contract (native Space/Enter), so there's no custom key handling —
 * "only build what HTML can't". `aria-expanded` on the trigger + `aria-controls`/`aria-labelledby`
 * wire the two parts; state is mirrored as `data-state="open|closed"` (+ `data-disabled`) for the theme.
 */
export function collapsible(
  state: Readonly<CollapsibleState>,
  set: (next: CollapsibleState) => void,
): CollapsibleApi {
  const dataState = openState(state.open);
  const disabled = state.disabled ?? false;
  const triggerId = `${state.id}-trigger`;
  const contentId = `${state.id}-content`;
  const toggle = (): void => {
    if (disabled) {
      return;
    }
    set({ ...state, open: !state.open });
  };
  return {
    contentProps: {
      "aria-labelledby": triggerId,
      "data-state": dataState,
      id: contentId,
      role: "region",
    },
    open: state.open,
    rootProps: {
      "data-state": dataState,
      ...when(disabled, { "data-disabled": "" }),
    },
    toggle,
    triggerProps: {
      "aria-controls": contentId,
      "aria-expanded": state.open,
      "data-state": dataState,
      id: triggerId,
      onClick: toggle,
      type: "button",
      ...when(disabled, { "data-disabled": "", disabled: true }),
    },
  };
}
