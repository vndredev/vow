import { activeState, backwardIndex, forwardIndex, rovingTabindex } from "./attrs.ts";
import type { Props } from "./types.ts";
import { focusSiblingFromTab } from "./dom.ts";

export type Orientation = "horizontal" | "vertical";

export interface TabsState {
  readonly value: string;
  readonly items: readonly string[];
  /** A stable base id to wire each tab and its panel (aria-controls / aria-labelledby). */
  readonly id: string;
  readonly orientation?: Orientation;
}

export interface TabsApi {
  readonly value: string;
  /** Props for the outer wrapper (carries `data-orientation`). */
  readonly rootProps: Props;
  /** Props for the tablist container. */
  readonly listProps: Props;
  /** Per-tab props (roving focus + selection) for the tab with this value. */
  tabProps(item: string): Props;
  /** Per-panel props for the panel of this value. */
  panelProps(item: string): Props;
  select(item: string): void;
}

/** The forward/backward arrow keys for an orientation (vertical uses up/down, horizontal left/right). */
function arrowKeys(orientation: Orientation): { forward: string; backward: string } {
  if (orientation === "vertical") {
    return { backward: "ArrowUp", forward: "ArrowDown" };
  }
  return { backward: "ArrowLeft", forward: "ArrowRight" };
}

/** Map an arrow/Home/End key to a target index in a list of `length` (or the same index otherwise). */
function stepIndex(
  key: string,
  index: number,
  config: Readonly<{ forward: string; backward: string; length: number }>,
): number {
  const { forward, backward, length } = config;
  if (key === forward) {
    return forwardIndex(index, length);
  }
  if (key === backward) {
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
 * The next tab value for an arrow/Home/End key (wrapping). Returns `current` unchanged for any other key
 * or an unknown current — so the caller acts only when the value actually moves (no `undefined` sentinel).
 */
function nextTabValue(
  key: string,
  current: string,
  config: Readonly<{ items: readonly string[]; orientation: Orientation }>,
): string {
  const { items, orientation } = config;
  const index = items.indexOf(current);
  if (index === -1) {
    return current;
  }
  const { forward, backward } = arrowKeys(orientation);
  const target = stepIndex(key, index, { backward, forward, length: items.length });
  return items.at(target) ?? current;
}

/** The per-tab context a `tabProps` build needs: whether it's active, its ids, and its event handlers. */
interface TabContext {
  readonly active: boolean;
  readonly tabId: (item: string) => string;
  readonly panelId: (item: string) => string;
  readonly select: (item: string) => void;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
  readonly onKeydown: (item: string, event: KeyboardEvent) => void;
}

/** Build the props for one tab — the APG `role="tab"` contract + roving tabindex + its handlers. */
function tabProps(item: string, ctx: Readonly<TabContext>): Props {
  return {
    "aria-controls": ctx.panelId(item),
    "aria-selected": ctx.active,
    "data-state": activeState(ctx.active),
    id: ctx.tabId(item),
    onClick: (): void => {
      ctx.select(item);
    },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
    onKeydown: (event: KeyboardEvent): void => {
      ctx.onKeydown(item, event);
    },
    role: "tab",
    tabindex: rovingTabindex(ctx.active),
    type: "button",
  };
}

/**
 * The tabs primitive — WAI-ARIA APG tablist. A `role="tablist"` of `role="tab"` buttons
 * over `role="tabpanel"` regions. Roving focus: only the selected tab is tabbable (`tabindex` 0, the
 * rest -1), and Arrow/Home/End move selection *and* focus (automatic activation). The focus move runs
 * in the keydown handler against the event's OWN DOM subtree (no globals) — so it's proven against the
 * platform like every primitive. State is mirrored as `data-state="active|inactive"` per part.
 */
export function tabs(state: Readonly<TabsState>, set: (next: TabsState) => void): TabsApi {
  const orientation = state.orientation ?? "horizontal";
  const tabId = (item: string): string => `${state.id}-tab-${state.items.indexOf(item)}`;
  const panelId = (item: string): string => `${state.id}-panel-${state.items.indexOf(item)}`;
  const select = (item: string): void => {
    if (item !== state.value) {
      set({ ...state, value: item });
    }
  };
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
  const onTabKeydown = (item: string, event: KeyboardEvent): void => {
    const next = nextTabValue(event.key, item, { items: state.items, orientation });
    if (next === item) {
      return;
    }
    event.preventDefault();
    select(next);
    focusSiblingFromTab(event.currentTarget, state.items.indexOf(next));
  };
  return {
    listProps: { "aria-orientation": orientation, role: "tablist" },
    panelProps(item) {
      const active = item === state.value;
      return {
        "aria-labelledby": tabId(item),
        "data-state": activeState(active),
        id: panelId(item),
        role: "tabpanel",
        tabindex: 0,
      };
    },
    rootProps: { "data-orientation": orientation },
    select,
    tabProps(item) {
      return tabProps(item, {
        active: item === state.value,
        onKeydown: onTabKeydown,
        panelId,
        select,
        tabId,
      });
    },
    value: state.value,
  };
}
