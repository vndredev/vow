import type { Props } from "./types.ts";
import { openState } from "./attrs.ts";
import { withTargetElement } from "./dom.ts";

export interface DialogState {
  readonly open: boolean;
  /** A stable base id to wire the content to its title (aria-labelledby). */
  readonly id: string;
}

export interface DialogApi {
  readonly open: boolean;
  /** Props for the backdrop overlay (click to dismiss). */
  readonly overlayProps: Props;
  /** Props for the modal content: role=dialog, aria-modal, Esc-to-close + a Tab focus-trap. */
  readonly contentProps: Props;
  /** Props for the title element (wired to the content via aria-labelledby). */
  readonly titleProps: Props;
  /** Props for the close button. */
  readonly closeProps: Props;
  close(): void;
}

/** What counts as tabbable inside a dialog — for the focus trap (excludes tabindex="-1"). */
const DIALOG_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The first and last focusable elements inside the dialog content (the tab-order edges). */
interface TabEdges {
  readonly first: HTMLElement;
  readonly last: HTMLElement;
}

/** Move focus across the tab-order edge: backward off the first wraps to the last, and vice versa. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM types, inherently mutable.
function wrapAtEdge(event: KeyboardEvent, active: Element | null, edges: TabEdges): void {
  if (event.shiftKey && active === edges.first) {
    event.preventDefault();
    edges.last.focus();
  } else if (!event.shiftKey && active === edges.last) {
    event.preventDefault();
    edges.first.focus();
  }
}

/**
 * Tab from the content container itself (`tabindex="-1"`, where focus rests right after open): it sits
 * outside the focusable order, so Shift+Tab wraps to the last edge and plain Tab steps into the first.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM types, inherently mutable.
function wrapFromContent(event: KeyboardEvent, edges: TabEdges): void {
  event.preventDefault();
  if (event.shiftKey) {
    edges.last.focus();
  } else {
    edges.first.focus();
  }
}

/** Route a trapped Tab to the right wrap: from the content container itself, or off a tab-order edge. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM types, inherently mutable.
function wrapTab(event: KeyboardEvent, content: HTMLElement, edges: TabEdges): void {
  if (content.ownerDocument.activeElement === content) {
    wrapFromContent(event, edges);
  } else {
    wrapAtEdge(event, content.ownerDocument.activeElement, edges);
  }
}

/** Wrap focus from one edge of the tab order to the other when Tab would leave the content. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM types, inherently mutable.
function wrapFocus(event: KeyboardEvent, content: HTMLElement): void {
  const focusables = content.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE);
  const first = focusables.item(0);
  const last = focusables.item(focusables.length - 1);
  if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) {
    event.preventDefault();
    return;
  }
  wrapTab(event, content, { first, last });
}

/**
 * Trap **Tab** within the content (wrapping at both ends), against the event's own subtree. With no
 * tabbable child, Tab is simply swallowed so focus can't leave the modal.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM type, inherently mutable.
function trapTab(event: KeyboardEvent): void {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- inferred DOM element, inherently mutable.
  withTargetElement(event.currentTarget, (content) => {
    wrapFocus(event, content);
  });
}

/**
 * The dialog (modal) primitive. A `role="dialog" aria-modal` content over a dismiss
 * overlay; **Escape** closes and **Tab** is trapped within the content (both in the keydown handler,
 * against the event's own subtree — proven against the platform). Opening is controlled by the host
 * (a v-model), so there's no owned trigger. The non-event glue — moving focus in on open, restoring it
 * on close, locking body scroll — is the adapter's job (it reacts to the open state, not to an event).
 */
export function dialog(state: Readonly<DialogState>, set: (next: DialogState) => void): DialogApi {
  const dataState = openState(state.open);
  const titleId = `${state.id}-title`;
  const close = (): void => {
    if (state.open) {
      set({ ...state, open: false });
    }
  };
  return {
    close,
    closeProps: {
      "aria-label": "Close",
      onClick: close,
      type: "button",
    },
    contentProps: {
      "aria-labelledby": titleId,
      "aria-modal": "true",
      "data-state": dataState,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
      onKeydown: (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        } else if (event.key === "Tab") {
          trapTab(event);
        }
      },
      role: "dialog",
      tabindex: -1,
    },
    open: state.open,
    overlayProps: {
      "data-state": dataState,
      onClick: close,
    },
    titleProps: { id: titleId },
  };
}
