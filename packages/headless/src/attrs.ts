import type { Props } from "./types.ts";

/**
 * Shared building blocks for the headless primitives' part-props.
 *
 * Every primitive returns plain prop records (ARIA attributes + `data-*` state hooks + handlers) that an
 * adapter spreads onto an element. Two needs recur: expressing an ATTRIBUTE THAT MAY BE ABSENT (a missing
 * key, never a literal `undefined`), and naming the state strings the theme hooks. Both live here, once.
 */

/**
 * Conditionally include props. When `on` is true the given keys are merged in; otherwise they are omitted
 * entirely (an absent attribute, not `undefined`). Spread it into a prop literal — `sort-keys` orders the
 * keys within each contiguous run, so keep the merged sub-object's own keys sorted too.
 */
export function when(on: boolean, props: Readonly<Props>): Props {
  if (on) {
    return { ...props };
  }
  return {};
}

/** The two-state hook string a checkbox/switch/radio mirrors onto each part. */
export function checkedState(checked: boolean): "checked" | "unchecked" {
  if (checked) {
    return "checked";
  }
  return "unchecked";
}

/** The two-state hook string a collapsible/dialog/select mirrors onto each part. */
export function openState(open: boolean): "closed" | "open" {
  if (open) {
    return "open";
  }
  return "closed";
}

/** The two-state hook string a tab/panel mirrors (selected vs not). */
export function activeState(active: boolean): "active" | "inactive" {
  if (active) {
    return "active";
  }
  return "inactive";
}

/** The roving `tabindex`: the single tabbable element is `0`, every other is `-1`. */
export function rovingTabindex(tabbable: boolean): number {
  if (tabbable) {
    return 0;
  }
  return -1;
}

/** The neighbour index when stepping forward from `index` in a list of `length`, wrapping to the front. */
export function forwardIndex(index: number, length: number): number {
  if (index === length - 1) {
    return 0;
  }
  return index + 1;
}

/** The neighbour index when stepping backward from `index` in a list of `length`, wrapping to the back. */
export function backwardIndex(index: number, length: number): number {
  if (index === 0) {
    return length - 1;
  }
  return index - 1;
}
