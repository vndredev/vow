import { NONE, defined } from "./maybe.ts";
import { bound, comp, el, sattr, txt } from "./node.ts";
import type { Maybe } from "./types.ts";
import type { UiNode } from "@vow/component";

/** A task-list item, parsed: its checked state and the content with the `[ ]`/`[x]` marker stripped. */
export interface TaskItem {
  readonly checked: boolean;
  readonly kids: readonly UiNode[];
}

/** The leading text of an item's first node + a rebuilder that re-emits the kids with `stripped` text. */
interface Lead {
  readonly rebuild: (stripped: string) => UiNode[];
  readonly text: string;
}

const TASK_MARKER = /^\[([ xX])\]\s+/u;
const CHECKED = "x";

/** The text-node shape — the `kind: "text"` member of `UiNode`. */
type TextNodeLike = Extract<UiNode, { kind: "text" }>;

/** A wrapper node that carries children — the `element`/`component` member of `UiNode`. */
type WrapperNode = Extract<UiNode, { children: readonly UiNode[] }>;

/** A node that carries children (element or component) — the shape whose first child we can peek into. */
function hasChildren(node: UiNode): node is WrapperNode {
  return node.kind === "element" || node.kind === "component";
}

/** A `Lead` from a leading text node directly under the item. */
function leadFromText(first: TextNodeLike, rest: readonly UiNode[]): Lead {
  return { rebuild: (stripped) => [txt(stripped), ...rest], text: first.text };
}

/** A `Lead` from a text node nested one level inside a wrapper (element/component) node. */
function leadFromWrapper(wrapper: WrapperNode, inner: TextNodeLike, rest: readonly UiNode[]): Lead {
  const innerRest = wrapper.children.slice(1);
  return {
    rebuild: (stripped) => [{ ...wrapper, children: [txt(stripped), ...innerRest] }, ...rest],
    text: inner.text,
  };
}

/** The leading text run of an item's kids — directly (a text node) or one level into a wrapper node. */
function leadOf(kids: readonly UiNode[]): Maybe<Lead> {
  const [first, ...rest] = kids;
  if (!defined(first)) {
    return NONE;
  }
  if (first.kind === "text") {
    return leadFromText(first, rest);
  }
  if (hasChildren(first)) {
    const [inner] = first.children;
    if (defined(inner) && inner.kind === "text") {
      return leadFromWrapper(first, inner, rest);
    }
  }
  return NONE;
}

/**
 * A markdown task-list item (`[x] …` / `[ ] …`)? If so, return its checked state and the content with
 * the `[ ]`/`[x]` marker stripped from the first text node — for rendering vow's Checkbox primitive.
 */
export function asTaskItem(kids: readonly UiNode[]): Maybe<TaskItem> {
  const lead = leadOf(kids);
  if (!defined(lead)) {
    return NONE;
  }
  const match = TASK_MARKER.exec(lead.text);
  if (match === null) {
    return NONE;
  }
  return {
    checked: match[1]?.toLowerCase() === CHECKED,
    kids: lead.rebuild(lead.text.slice(match[0].length)),
  };
}

/** Render a parsed task item as `<li class="vow-task">` with a disabled Checkbox + its label span. */
export function taskItemNode(task: TaskItem): UiNode {
  let checked = "false";
  if (task.checked) {
    checked = "true";
  }
  const box = comp(
    "Checkbox",
    [bound("modelValue", checked), bound("disabled", "true"), sattr("label", "")],
    [],
  );
  // Wrap the content in ONE span so the flex row has two items (box + label), not one per node.
  const label = el("span", task.kids, [sattr("class", "vow-task__label")]);
  return el("li", [box, label], [sattr("class", "vow-task")]);
}
