import { CLOSE, NOOP, fenceStep, openStep, pushStep, runWalk } from "./walk.ts";
import type { Frame, Maybe, Step, TocEntry, Tok } from "./types.ts";
import { NONE, defined } from "./maybe.ts";
import { asTaskItem, taskItemNode } from "./task-list.ts";
import { codeNode, fenceLabel, openContainerFrame } from "./container.ts";
import { el, sattr, textOf } from "./node.ts";
import type { ReadHighlighter } from "./highlight.ts";
import type { UiNode } from "@vow/component";
import { inlineToNodes } from "./inline.ts";
import { makeRecorder } from "./slug.ts";

/** Record an h2/h3 heading and return its anchor id, or absence (no toc / not an h2|h3). */
type RecordHeading = (level: number, text: string) => Maybe<string>;

const CONTAINER_PREFIX = "container_";
const OPEN = "_open";
const CLOSE_SUFFIX = "_close";

/** A heading `_open` frame — its build records the heading (id + toc entry) and tags the element. */
function headingFrame(token: Tok, record: RecordHeading): Frame {
  const { tag } = token;
  const level = Number(tag.slice(1));
  return {
    build: (kids) => {
      const id = record(level, textOf(kids));
      if (defined(id)) {
        return el(tag, kids, [sattr("id", id)]);
      }
      return el(tag, kids);
    },
  };
}

/** A list-item `_open` frame — a `[x]`/`[ ]` item renders vow's disabled Checkbox + its content. */
function listItemFrame(): Frame {
  return {
    build: (kids) => {
      const task = asTaskItem(kids);
      if (defined(task)) {
        return taskItemNode(task);
      }
      return el("li", kids);
    },
  };
}

/** The frame a non-container `_open` token opens (heading / list-item / generic element). */
function openBlockFrame(token: Tok, record: RecordHeading): Frame {
  if (token.type === "heading_open") {
    return headingFrame(token, record);
  }
  if (token.type === "list_item_open") {
    return listItemFrame();
  }
  const tag = token.tag || "div";
  return { build: (kids) => el(tag, kids) };
}

/** An `_open` token → the frame to open (a `:::` container kind, or a block element). */
function openFrame(token: Tok, record: RecordHeading): Frame {
  if (token.type.startsWith(CONTAINER_PREFIX)) {
    const name = token.type.slice(CONTAINER_PREFIX.length, -OPEN.length);
    return openContainerFrame(name, token.info);
  }
  return openBlockFrame(token, record);
}

/** A tight-list item wraps its content in a hidden `<p>` — those opens/closes are skipped. */
function isHiddenParagraph(token: Tok): boolean {
  return (token.type === "paragraph_open" || token.type === "paragraph_close") && token.hidden;
}

/** A content (leaf) block token → its step: inline run, fenced code, or a rule. Else absence. */
function contentStep(token: Tok, hl: Maybe<ReadHighlighter>): Maybe<Step> {
  if (token.type === "inline") {
    return pushStep(...inlineToNodes(token.children));
  }
  if (token.type === "fence" || token.type === "code_block") {
    return fenceStep(codeNode(token.content, token.info, hl), fenceLabel(token.info));
  }
  if (token.type === "hr") {
    return pushStep(el("hr", []));
  }
  return NONE;
}

/** A structural block token → its step: open a frame, or close the top one. Else absence. */
function structureStep(token: Tok, record: RecordHeading): Maybe<Step> {
  if (token.type.endsWith(OPEN)) {
    return openStep(openFrame(token, record));
  }
  if (token.type.endsWith(CLOSE_SUFFIX)) {
    return CLOSE;
  }
  return NONE;
}

/** One block token → its step, given the (read-only) highlighter and the heading recorder. */
function blockStep(token: Tok, hl: Maybe<ReadHighlighter>, record: RecordHeading): Step {
  if (isHiddenParagraph(token)) {
    return NOOP;
  }
  return contentStep(token, hl) ?? structureStep(token, record) ?? NOOP;
}

/**
 * Block tokens → block UiNodes. Tag-driven opens (p/h2/ul/li/blockquote); fences → code node;
 * h2/h3 get a slug id and (if `toc` is given) feed the "on this page" entries.
 */
export function blockToNodes(
  tokens: readonly Tok[],
  hl?: Maybe<ReadHighlighter>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `toc` is the caller's output array by API contract (the "on this page" entries are appended into it).
  toc?: Maybe<TocEntry[]>,
): UiNode[] {
  const record = makeRecorder(toc);
  return runWalk(tokens, (token) => blockStep(token, hl, record));
}
