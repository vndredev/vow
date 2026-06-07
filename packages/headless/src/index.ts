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

export interface CollapsibleState {
  readonly open: boolean;
  /** A stable base id to wire the trigger ↔ content (aria-controls / aria-labelledby). */
  readonly id: string;
  readonly disabled?: boolean;
}

export interface CollapsibleApi {
  readonly open: boolean;
  /** Props for the outer wrapper (carries the state hooks for theming). */
  readonly rootProps: Record<string, unknown>;
  /** Props for the focusable trigger — a `<button>` that expands/collapses the region. */
  readonly triggerProps: Record<string, unknown>;
  /** Props for the collapsible content region; the adapter renders it under `v-show="open"`. */
  readonly contentProps: Record<string, unknown>;
  toggle(): void;
}

/**
 * The collapsible (disclosure) primitive — Reka-style. A `<button>` trigger toggles a content region;
 * the button is the whole keyboard contract (native Space/Enter), so there's no custom key handling —
 * "only build what HTML can't". `aria-expanded` on the trigger + `aria-controls`/`aria-labelledby`
 * wire the two parts; state is mirrored as `data-state="open|closed"` (+ `data-disabled`) for the theme.
 */
export function collapsible(
  state: CollapsibleState,
  set: (next: CollapsibleState) => void,
): CollapsibleApi {
  const dataState = state.open ? "open" : "closed";
  const triggerId = `${state.id}-trigger`;
  const contentId = `${state.id}-content`;
  const toggle = (): void => {
    if (state.disabled) return;
    set({ ...state, open: !state.open });
  };
  return {
    open: state.open,
    rootProps: {
      "data-state": dataState,
      "data-disabled": state.disabled ? "" : undefined,
    },
    triggerProps: {
      id: triggerId,
      type: "button",
      "aria-expanded": state.open,
      "aria-controls": contentId,
      "data-state": dataState,
      "data-disabled": state.disabled ? "" : undefined,
      disabled: state.disabled || undefined,
      onClick: toggle,
    },
    contentProps: {
      id: contentId,
      role: "region",
      "aria-labelledby": triggerId,
      "data-state": dataState,
    },
    toggle,
  };
}

export interface TabsState {
  readonly value: string;
  readonly items: readonly string[];
  /** A stable base id to wire each tab ↔ its panel (aria-controls / aria-labelledby). */
  readonly id: string;
  readonly orientation?: "horizontal" | "vertical";
}

export interface TabsApi {
  readonly value: string;
  /** Props for the outer wrapper (carries `data-orientation`). */
  readonly rootProps: Record<string, unknown>;
  /** Props for the tablist container. */
  readonly listProps: Record<string, unknown>;
  /** Per-tab props (roving focus + selection) for the tab with this value. */
  tabProps(item: string): Record<string, unknown>;
  /** Per-panel props for the panel of this value. */
  panelProps(item: string): Record<string, unknown>;
  select(item: string): void;
}

/** The next tab value for an arrow/Home/End key (wrapping), or undefined for any other key. */
function nextTabValue(
  key: string,
  current: string,
  items: readonly string[],
  orientation: "horizontal" | "vertical",
): string | undefined {
  const i = items.indexOf(current);
  if (i === -1) return undefined;
  const last = items.length - 1;
  const forward = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
  const backward = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  if (key === forward) return items[i === last ? 0 : i + 1];
  if (key === backward) return items[i === 0 ? last : i - 1];
  if (key === "Home") return items[0];
  if (key === "End") return items[last];
  return undefined;
}

/**
 * The tabs primitive — WAI-ARIA APG tablist, Reka-style. A `role="tablist"` of `role="tab"` buttons
 * over `role="tabpanel"` regions. Roving focus: only the selected tab is tabbable (`tabindex` 0, the
 * rest -1), and Arrow/Home/End move selection *and* focus (automatic activation). The focus move runs
 * in the keydown handler against the event's OWN DOM subtree (no globals) — so it's proven against the
 * platform like every primitive. State is mirrored as `data-state="active|inactive"` per part.
 */
export function tabs(state: TabsState, set: (next: TabsState) => void): TabsApi {
  const orientation = state.orientation ?? "horizontal";
  const select = (item: string): void => {
    if (item !== state.value) set({ ...state, value: item });
  };
  const tabId = (item: string): string => `${state.id}-tab-${state.items.indexOf(item)}`;
  const panelId = (item: string): string => `${state.id}-panel-${state.items.indexOf(item)}`;
  return {
    value: state.value,
    rootProps: { "data-orientation": orientation },
    listProps: { role: "tablist", "aria-orientation": orientation },
    tabProps(item) {
      const active = item === state.value;
      return {
        id: tabId(item),
        type: "button",
        role: "tab",
        "aria-selected": active,
        "aria-controls": panelId(item),
        tabindex: active ? 0 : -1,
        "data-state": active ? "active" : "inactive",
        onClick: (): void => select(item),
        onKeydown: (event: KeyboardEvent): void => {
          const next = nextTabValue(event.key, item, state.items, orientation);
          if (next === undefined) return;
          event.preventDefault();
          select(next);
          const list = (event.currentTarget as HTMLElement | null)?.parentElement;
          const tabEls = list?.querySelectorAll<HTMLElement>('[role="tab"]');
          tabEls?.[state.items.indexOf(next)]?.focus();
        },
      };
    },
    panelProps(item) {
      const active = item === state.value;
      return {
        id: panelId(item),
        role: "tabpanel",
        "aria-labelledby": tabId(item),
        tabindex: 0,
        "data-state": active ? "active" : "inactive",
      };
    },
    select,
  };
}

export interface DialogState {
  readonly open: boolean;
  /** A stable base id to wire the content to its title (aria-labelledby). */
  readonly id: string;
}

export interface DialogApi {
  readonly open: boolean;
  /** Props for the backdrop overlay (click to dismiss). */
  readonly overlayProps: Record<string, unknown>;
  /** Props for the modal content: role=dialog, aria-modal, Esc-to-close + a Tab focus-trap. */
  readonly contentProps: Record<string, unknown>;
  /** Props for the title element (wired to the content via aria-labelledby). */
  readonly titleProps: Record<string, unknown>;
  /** Props for the close button. */
  readonly closeProps: Record<string, unknown>;
  close(): void;
}

/** What counts as tabbable inside a dialog — for the focus trap (excludes tabindex="-1"). */
const DIALOG_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The dialog (modal) primitive — Reka-style. A `role="dialog" aria-modal` content over a dismiss
 * overlay; **Escape** closes and **Tab** is trapped within the content (both in the keydown handler,
 * against the event's own subtree — proven against the platform). Opening is controlled by the host
 * (a v-model), so there's no owned trigger. The non-event glue — moving focus in on open, restoring it
 * on close, locking body scroll — is the adapter's job (it reacts to the open state, not to an event).
 */
export function dialog(state: DialogState, set: (next: DialogState) => void): DialogApi {
  const dataState = state.open ? "open" : "closed";
  const titleId = `${state.id}-title`;
  const close = (): void => {
    if (state.open) set({ ...state, open: false });
  };
  return {
    open: state.open,
    overlayProps: {
      "data-state": dataState,
      onClick: close,
    },
    contentProps: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      tabindex: -1,
      "data-state": dataState,
      onKeydown: (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
          return;
        }
        if (event.key !== "Tab") return;
        const content = event.currentTarget as HTMLElement | null;
        if (!content) return;
        const focusables = [...content.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE)];
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = content.ownerDocument.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first?.focus();
        }
      },
    },
    titleProps: { id: titleId },
    closeProps: {
      type: "button",
      "aria-label": "Close",
      onClick: close,
    },
    close,
  };
}
