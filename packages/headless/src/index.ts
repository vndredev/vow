/**
 * Headless primitives for vow — framework-agnostic UI logic, vow's own, scoped to what we need.
 *
 * Each primitive is a pure function: it takes the current state + a setter and returns the DOM props
 * (ARIA attributes + event handlers + `data-*` state hooks) for each part. Framework adapters (Vue,
 * React) only bind their reactivity and spread the props — the logic lives here, once, for every
 * framework. vow then dresses the parts with its own base look (`@vow/theme`), targeting the hooks.
 *
 * We build a primitive ONLY where HTML can't do it natively. A `<button>` is already accessible, so
 * there's no Button here — but a custom checkbox needs role/aria/keyboard/state wiring, so it earns
 * one. vow's convention: the control is a `<button role="checkbox">`, state is exposed as
 * `data-state="checked|unchecked"` (+ `data-disabled`), and a separate indicator part shows the mark.
 *
 * The public API is one focused module per primitive, re-exported here.
 */

export { checkbox, type CheckboxApi, type CheckboxState } from "./checkbox.ts";
export { collapsible, type CollapsibleApi, type CollapsibleState } from "./collapsible.ts";
export {
  contextMenu,
  type ContextMenuApi,
  type ContextMenuItem,
  type ContextMenuState,
} from "./context-menu.ts";
export { dialog, type DialogApi, type DialogState } from "./dialog.ts";
export { radioGroup, type RadioGroupApi, type RadioGroupState } from "./radio-group.ts";
export { select, type SelectApi, type SelectOption, type SelectState } from "./select.ts";
export { switch_, type SwitchApi, type SwitchState } from "./switch.ts";
export { type Orientation, tabs, type TabsApi, type TabsState } from "./tabs.ts";
export type { Maybe, Props } from "./types.ts";
