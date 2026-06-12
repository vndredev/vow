import { checkedState, openState, when } from "./attrs.ts";
import type { Props } from "./types.ts";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectState {
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly open: boolean;
  /** The highlighted option value while open (drives aria-activedescendant + data-active). */
  readonly active: string;
  /** The type-ahead buffer the host holds; the adapter clears it after a short idle (~500ms). */
  readonly typed?: string;
  /** A stable base id to wire trigger, listbox and options. */
  readonly id: string;
  /** The trigger's id — defaults to `<id>-trigger`; a form overrides it so a `<label for>` lines up. */
  readonly triggerId?: string;
  readonly disabled?: boolean;
}

export interface SelectApi {
  readonly open: boolean;
  /** The label of the selected option (empty if none selected). */
  readonly selectedLabel: string;
  /** Props for the outer wrapper (carries the state hooks for theming). */
  readonly rootProps: Props;
  /** Props for the focusable trigger — a `<button role="combobox">`. */
  readonly triggerProps: Props;
  /** Props for the popup listbox. */
  readonly listboxProps: Props;
  /** Per-option props for the given option. */
  optionProps(option: Readonly<SelectOption>): Props;
  select(value: string): void;
  close(): void;
}

/** A step away from the current option (1 = next, -1 = previous). */
type Step = 1 | -1;

/** The next option value for an arrow step (wrapping), or `current` if there are no options. */
function nextOptionValue(values: readonly string[], current: string, dir: Step): string {
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

/** A printable single character — the type-ahead keys (excludes Space, which commits). */
function isTypeAheadChar(key: string): boolean {
  return key.length === 1 && key !== " ";
}

/**
 * The first option whose label starts with `buffer` (case-insensitive), scanning from `active` onward and
 * wrapping, or `active` if none match — the pure core of type-ahead (the adapter owns only the buffer's
 * debounce timer).
 */
function typeaheadMatch(options: readonly SelectOption[], active: string, buffer: string): string {
  if (buffer === "") {
    return active;
  }
  const needle = buffer.toLowerCase();
  const offset = Math.max(
    0,
    options.findIndex((option) => option.value === active),
  );
  // Rotate by slicing (no indexed access) so the scan starts at the active option and wraps the end.
  const rotated = [...options.slice(offset), ...options.slice(0, offset)];
  const hit = rotated.find((option) => option.label.toLowerCase().startsWith(needle));
  return hit?.value ?? active;
}

/** The transitions a select can make — the verbs the trigger's click + keydown call. */
interface SelectActions {
  readonly openWith: () => void;
  readonly close: () => void;
  readonly setActive: (value: string) => void;
  readonly commit: (value: string) => void;
  readonly typeAhead: (char: string) => void;
}

/** Build the select's transitions over the current state + setter. */
function selectActions(
  state: Readonly<SelectState>,
  values: readonly string[],
  set: (next: SelectState) => void,
): SelectActions {
  const firstValue = values.at(0) ?? "";
  return {
    close(): void {
      if (state.open) {
        set({ ...state, open: false });
      }
    },
    commit(value: string): void {
      set({ ...state, open: false, value });
    },
    openWith(): void {
      let active = firstValue;
      if (values.includes(state.value)) {
        active = state.value;
      }
      set({ ...state, active, open: true });
    },
    setActive(value: string): void {
      set({ ...state, active: value });
    },
    typeAhead(char: string): void {
      const typed = (state.typed ?? "") + char;
      const active = typeaheadMatch(state.options, state.active, typed);
      set({ ...state, active, typed });
    },
  };
}

/** The state + bounds + transitions a select's keyboard handling reads. */
interface SelectKeyContext {
  readonly open: boolean;
  readonly active: string;
  readonly values: readonly string[];
  readonly first: string;
  readonly last: string;
  readonly actions: SelectActions;
}

/** Whether a key opens a closed select (the arrow/Enter/Space that pop the listbox). */
function opensSelect(key: string): boolean {
  return key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ";
}

/** The active value an arrow/Home/End key moves the highlight to, or `current` for a non-move key. */
function movedActive(key: string, ctx: Readonly<SelectKeyContext>): string {
  if (key === "ArrowDown") {
    return nextOptionValue(ctx.values, ctx.active, 1);
  }
  if (key === "ArrowUp") {
    return nextOptionValue(ctx.values, ctx.active, -1);
  }
  if (key === "Home") {
    return ctx.first;
  }
  if (key === "End") {
    return ctx.last;
  }
  return ctx.active;
}

/** Apply a recognized commit/close key for an open select; returns whether the key was handled. */
function commitOrClose(key: string, actions: Readonly<SelectActions>, active: string): boolean {
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

/** Apply an open select's non-Tab key (move the highlight, commit, close, or type-ahead); was it handled? */
function applyOpenKey(key: string, ctx: Readonly<SelectKeyContext>): boolean {
  const moved = movedActive(key, ctx);
  if (moved !== ctx.active) {
    ctx.actions.setActive(moved);
    return true;
  }
  if (commitOrClose(key, ctx.actions, ctx.active)) {
    return true;
  }
  if (isTypeAheadChar(key)) {
    ctx.actions.typeAhead(key);
    return true;
  }
  return false;
}

/** Drive an OPEN select's keydown: move the highlight, commit it, or close (Tab closes silently). */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
function navigateKeydown(event: KeyboardEvent, ctx: Readonly<SelectKeyContext>): void {
  const { key } = event;
  if (key === "Tab") {
    ctx.actions.close();
    return;
  }
  if (applyOpenKey(key, ctx)) {
    event.preventDefault();
  }
}

/** Drive the trigger's keydown: open when closed, else navigate the open listbox. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
function onTriggerKeydown(event: KeyboardEvent, ctx: Readonly<SelectKeyContext>): void {
  if (!ctx.open) {
    if (opensSelect(event.key)) {
      event.preventDefault();
      ctx.actions.openWith();
    }
    return;
  }
  navigateKeydown(event, ctx);
}

/** The ids that wire a select's trigger, listbox and options together. */
interface SelectIds {
  readonly triggerId: string;
  readonly listboxId: string;
  readonly optionId: (value: string) => string;
}

/** Build the trigger's props — the combobox contract + its click/keydown handlers. */
function triggerProps(
  state: Readonly<SelectState>,
  ids: Readonly<SelectIds>,
  ctx: Readonly<SelectKeyContext>,
): Props {
  const disabled = state.disabled ?? false;
  return {
    "aria-controls": ids.listboxId,
    "aria-expanded": state.open,
    "aria-haspopup": "listbox",
    "data-state": openState(state.open),
    id: ids.triggerId,
    onClick: (): void => {
      if (state.open) {
        ctx.actions.close();
      } else {
        ctx.actions.openWith();
      }
    },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
    onKeydown: (event: KeyboardEvent): void => {
      onTriggerKeydown(event, ctx);
    },
    role: "combobox",
    type: "button",
    ...when(state.open, { "aria-activedescendant": ids.optionId(state.active) }),
    ...when(disabled, { disabled: true }),
  };
}

/** The per-option context an option's props build over: the live state, its ids, and the commit verb. */
interface OptionContext {
  readonly state: Readonly<SelectState>;
  readonly ids: Readonly<SelectIds>;
  readonly commit: (value: string) => void;
}

/** Build one option's props — selection + active hooks + its commit handler. */
function optionProps(option: Readonly<SelectOption>, ctx: Readonly<OptionContext>): Props {
  const isSelected = option.value === ctx.state.value;
  return {
    "aria-selected": isSelected,
    "data-state": checkedState(isSelected),
    id: ctx.ids.optionId(option.value),
    onClick: (): void => {
      ctx.commit(option.value);
    },
    role: "option",
    ...when(option.value === ctx.state.active, { "data-active": "" }),
  };
}

/**
 * The select (listbox) primitive — WAI-ARIA APG combobox/listbox, Reka-style. A `role="combobox"`
 * button toggles a `role="listbox"` of `role="option"`s. Focus stays on the trigger; the highlighted
 * option is tracked with `aria-activedescendant` (no per-option DOM focus). Keyboard: Arrow/Home/End
 * move the highlight, a printable character type-aheads to the next matching label, Enter/Space commit,
 * Esc closes, Tab closes. `open` + `active` + `typed` are transient UI state the host holds; `value` is
 * the selection. State is mirrored as `data-state`/`data-active`.
 */
export function select(state: Readonly<SelectState>, set: (next: SelectState) => void): SelectApi {
  const values = state.options.map((option) => option.value);
  const ids: SelectIds = {
    listboxId: `${state.id}-listbox`,
    optionId: (value) => `${state.id}-option-${values.indexOf(value)}`,
    triggerId: state.triggerId ?? `${state.id}-trigger`,
  };
  const actions = selectActions(state, values, set);
  const ctx: SelectKeyContext = {
    actions,
    active: state.active,
    first: values.at(0) ?? "",
    last: values.at(-1) ?? "",
    open: state.open,
    values,
  };
  const selected = state.options.find((option) => option.value === state.value);
  return {
    close: actions.close,
    listboxProps: {
      "aria-labelledby": ids.triggerId,
      id: ids.listboxId,
      role: "listbox",
    },
    open: state.open,
    optionProps(option) {
      return optionProps(option, { commit: actions.commit, ids, state });
    },
    rootProps: {
      "data-state": openState(state.open),
      ...when(state.disabled ?? false, { "data-disabled": "" }),
    },
    select: actions.commit,
    selectedLabel: selected?.label ?? "",
    triggerProps: triggerProps(state, ids, ctx),
  };
}
