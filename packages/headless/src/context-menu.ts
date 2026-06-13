import { openState, when } from "./attrs.ts";
import type { Props } from "./types.ts";

export interface ContextMenuItem {
  readonly value: string;
  readonly label: string;
}

export interface ContextMenuState {
  /** Whether the menu is open — the host opens it on a right-click, positioning the panel at the cursor. */
  readonly open: boolean;
  /** The highlighted item value while open (drives aria-activedescendant + data-active). */
  readonly active: string;
  readonly items: readonly ContextMenuItem[];
  /** A stable base id to wire the panel + its items. */
  readonly id: string;
  /** Output-only: the value a commit just chose — read once by the host to emit, never fed back. */
  readonly chosen?: string;
}

export interface ContextMenuApi {
  readonly open: boolean;
  /** Props for the outer wrapper (carries the state hook for theming). */
  readonly rootProps: Props;
  /** Props for the floating `role="menu"` panel — focusable, with the keyboard handler. */
  readonly panelProps: Props;
  /** Per-item props for the given item. */
  itemProps(item: Readonly<ContextMenuItem>): Props;
  close(): void;
}

/** A step away from the current item (1 = next, -1 = previous). */
type Step = 1 | -1;

/** The next item value for an arrow step (wrapping), or `current` when there are no items. */
function nextItemValue(values: readonly string[], current: string, dir: Step): string {
  if (values.length === 0) {
    return current;
  }
  const index = values.indexOf(current);
  if (index === -1) {
    if (dir > 0) {
      return values.at(0) ?? current;
    }
    return values.at(-1) ?? current;
  }
  const nextIndex = (index + dir + values.length) % values.length;
  return values.at(nextIndex) ?? current;
}

/** The transitions a context menu can make — the verbs its panel keydown + item clicks call. */
interface MenuActions {
  readonly close: () => void;
  readonly setActive: (value: string) => void;
  readonly commit: (value: string) => void;
}

/** Build the menu's transitions over the current state + setter. */
function menuActions(
  state: Readonly<ContextMenuState>,
  set: (next: ContextMenuState) => void,
): MenuActions {
  return {
    close(): void {
      if (state.open) {
        set({ ...state, open: false });
      }
    },
    commit(value: string): void {
      set({ ...state, chosen: value, open: false });
    },
    setActive(value: string): void {
      set({ ...state, active: value });
    },
  };
}

/** The state + bounds + transitions the menu's keyboard handling reads. */
interface MenuKeyContext {
  readonly active: string;
  readonly values: readonly string[];
  readonly first: string;
  readonly last: string;
  readonly actions: MenuActions;
}

/** The active value an arrow/Home/End key moves the highlight to, or `current` for a non-move key. */
function movedActive(key: string, ctx: Readonly<MenuKeyContext>): string {
  if (key === "ArrowDown") {
    return nextItemValue(ctx.values, ctx.active, 1);
  }
  if (key === "ArrowUp") {
    return nextItemValue(ctx.values, ctx.active, -1);
  }
  if (key === "Home") {
    return ctx.first;
  }
  if (key === "End") {
    return ctx.last;
  }
  return ctx.active;
}

/** Apply a recognized commit/close key for an open menu; returns whether the key was handled. */
function commitOrClose(key: string, actions: Readonly<MenuActions>, active: string): boolean {
  if (key === "Enter" || key === " ") {
    actions.commit(active);
    return true;
  }
  if (key === "Escape") {
    actions.close();
    return true;
  }
  return false;
}

/** Apply an open menu's key — move the highlight, commit the active item, or close; was it handled? */
function applyMenuKey(key: string, ctx: Readonly<MenuKeyContext>): boolean {
  const moved = movedActive(key, ctx);
  if (moved !== ctx.active) {
    ctx.actions.setActive(moved);
    return true;
  }
  return commitOrClose(key, ctx.actions, ctx.active);
}

/** Drive the menu panel's keydown: navigate, commit the active item, or close (Tab closes too). */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
function onPanelKeydown(event: KeyboardEvent, ctx: Readonly<MenuKeyContext>): void {
  if (event.key === "Tab") {
    ctx.actions.close();
    return;
  }
  if (applyMenuKey(event.key, ctx)) {
    event.preventDefault();
  }
}

/** The per-item context an item's props build over: the highlight, its id, and the commit verb. */
interface ItemContext {
  readonly active: string;
  readonly itemId: (value: string) => string;
  readonly commit: (value: string) => void;
}

/** Build one item's props — the menuitem contract, the active hook, and its commit handler. */
function itemProps(item: Readonly<ContextMenuItem>, ctx: Readonly<ItemContext>): Props {
  return {
    id: ctx.itemId(item.value),
    onClick: (): void => {
      ctx.commit(item.value);
    },
    role: "menuitem",
    tabindex: -1,
    ...when(item.value === ctx.active, { "data-active": "" }),
  };
}

/**
 * The context-menu primitive — WAI-ARIA APG menu. The host opens it on a right-click (positioning the
 * panel at the cursor) and moves focus to the `role="menu"` panel; the highlighted item is tracked with
 * `aria-activedescendant` (no per-item focus). Keyboard: Arrow/Home/End move the highlight, Enter/Space
 * commit the active item, Esc/Tab close. `open` + `active` are transient UI state the host holds; a commit
 * surfaces the chosen value via `chosen` (output-only) for the host to emit. State is mirrored as
 * `data-state`/`data-active`.
 */
export function contextMenu(
  state: Readonly<ContextMenuState>,
  set: (next: ContextMenuState) => void,
): ContextMenuApi {
  const values = state.items.map((item) => item.value);
  const panelId = `${state.id}-menu`;
  const itemId = (value: string): string => `${state.id}-item-${values.indexOf(value)}`;
  const actions = menuActions(state, set);
  const ctx: MenuKeyContext = {
    actions,
    active: state.active,
    first: values.at(0) ?? "",
    last: values.at(-1) ?? "",
    values,
  };
  return {
    close: actions.close,
    itemProps(item) {
      return itemProps(item, { active: state.active, commit: actions.commit, itemId });
    },
    open: state.open,
    panelProps: {
      "data-state": openState(state.open),
      id: panelId,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
      onKeydown: (event: KeyboardEvent): void => {
        onPanelKeydown(event, ctx);
      },
      role: "menu",
      tabindex: -1,
      ...when(state.open, { "aria-activedescendant": itemId(state.active) }),
    },
    rootProps: {
      "data-state": openState(state.open),
    },
  };
}
