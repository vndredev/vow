/* oxlint-disable typescript/prefer-readonly-parameter-types -- a dev overlay is imperative DOM glue: it
   mutates its surface handles and reads live, inherently-mutable mouse/key events */
import type { Maybe } from "@vow/core";
import { NONE } from "../none.ts";

/**
 * The in-app issue reporter — a dev-only overlay the vow plugin injects into the running app (never a prod
 * build). Right-click anywhere opens a small menu — **Bug melden** or **Feature vorschlagen** (an issue is
 * not only a bug). Choosing one enters a pick mode where hovering highlights the element under the cursor
 * and a click selects it. The selected element is resolved to its **vow source** — the picker walks up to
 * the nearest `data-vow-source` (stamped on every generated root), so the report names the vow a UI bug /
 * feature lives in, not a blind selector. A small form (title + description, pre-filled with the source +
 * route) POSTs the report — with its `kind` — to `/__vow/issue`.
 *
 * Framework-free on purpose: it is plugin-shipped glue, not part of the app's spec. The look lives in ONE
 * injected stylesheet that reads vow's own theme tokens (so it matches light + dark) — the elements carry
 * classes, never inline styles, except the truly-dynamic cursor position. The DOM resolver is pure + tested.
 */

/** The id of the overlay's mount node — also the guard against a double `setup`. */
const MOUNT_ID = "vow-bug-reporter";
/** The overlay's z-index — above any app chrome (the dev tool always wins). */
const OVERLAY_Z = 2_147_483_000;
/** The highlight box sits one below the menu/form. */
const HIGHLIGHT_Z = OVERLAY_Z - 1;
/** Where the report form anchors from the top-left. */
const FORM_INSET = 24;

/** The overlay's one stylesheet — vow's theme tokens (loaded by the app's vow.css) with a literal fallback
    for any app without the theme, so it matches light + dark. Injected once; the elements carry classes. */
const OVERLAY_CSS = `
#${MOUNT_ID} .r-surface {
  position: fixed; z-index: ${OVERLAY_Z};
  background: var(--vow-color-bg, #1a1611);
  color: var(--vow-color-text, #eae3d5);
  border: 1px solid var(--vow-color-border, #3a332a);
  border-radius: var(--vow-radius-2, 7px);
  box-shadow: var(--vow-shadow-popover, 0 12px 32px -10px rgb(0 0 0 / 0.4));
  font: 13px/1.4 var(--vow-font-sans, ui-sans-serif, system-ui, sans-serif);
}
#${MOUNT_ID} .r-menu { padding: 4px; }
#${MOUNT_ID} .r-item {
  display: block; width: 100%; margin: 0; padding: 6px 12px;
  background: none; border: none; color: inherit; font: inherit;
  text-align: left; white-space: nowrap; cursor: pointer;
  border-radius: var(--vow-radius-1, 5px);
}
#${MOUNT_ID} .r-item:hover { background: var(--vow-color-surface, #2c2620); }
#${MOUNT_ID} .r-form { width: 320px; padding: 16px; }
#${MOUNT_ID} .r-head { font-weight: 600; margin-bottom: 4px; }
#${MOUNT_ID} .r-meta { font-size: 12px; color: var(--vow-color-muted, #b6ab97); margin-bottom: 12px; }
#${MOUNT_ID} .r-field {
  width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 8px; font: inherit;
  background: var(--vow-color-bg, #13100c); color: var(--vow-color-text, #eae3d5);
  border: 1px solid var(--vow-color-border, #3a332a); border-radius: var(--vow-radius-1, 5px);
}
#${MOUNT_ID} .r-field:focus { outline: 1px solid var(--vow-color-accent, #ee4b22); }
#${MOUNT_ID} .r-send {
  width: 100%; padding: 8px; font: inherit; font-weight: 600; cursor: pointer; color: #fff;
  background: var(--vow-color-accent, #ee4b22); border: none; border-radius: var(--vow-radius-1, 5px);
}
#${MOUNT_ID} .r-highlight {
  position: fixed; z-index: ${HIGHLIGHT_Z}; pointer-events: none; border-radius: 4px;
  border: 2px solid var(--vow-color-accent, #ee4b22); background: rgb(238 75 34 / 0.12);
}`;

/** Whether the report is a bug or a feature — an issue is either, and the endpoint labels it accordingly. */
export type IssueKind = "bug" | "feature";

/** The human heading + the verb each kind shows in the form + the menu. */
const KIND_LABEL: Readonly<Record<IssueKind, string>> = {
  bug: "Bug melden",
  feature: "Feature vorschlagen",
};

/** The report a selected element produces — what the form POSTs to `/__vow/issue`. */
export interface IssueReport {
  readonly kind: IssueKind;
  readonly title: string;
  readonly description: string;
  /** The vow the element came from (its `data-vow-source` slug), or "" when outside any generated root. */
  readonly source: string;
  /** The route the bug / feature was seen on. */
  readonly route: string;
  /** A coarse element hint — its tag + classes — so the agent can find it within the vow. */
  readonly element: string;
}

/** The overlay's mutable handles — the live menu, highlight box, and form, plus the kind being reported.
 *  Each surface is torn down at the next step so only one is ever live. */
interface Overlay {
  readonly mount: HTMLElement;
  menu: Maybe<HTMLElement>;
  highlight: Maybe<HTMLElement>;
  form: Maybe<HTMLElement>;
  picking: boolean;
  kind: IssueKind;
}

/** The vow source of an element — the nearest ancestor (or itself) carrying `data-vow-source`, else "". */
export function resolveVowSource(start: Element | null): string {
  const host = start?.closest("[data-vow-source]");
  if (host instanceof HTMLElement) {
    return host.dataset["vowSource"] ?? "";
  }
  return "";
}

/** A coarse, human-readable hint for an element — its tag plus any classes (the bug / feature "area"). */
export function elementHint(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.className === "") {
    return tag;
  }
  return `${tag}.${el.className.trim().split(/\s+/u).join(".")}`;
}

/** Whether a node is part of the overlay itself — so interacting with the overlay never re-triggers it. */
function isOverlay(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest(`#${MOUNT_ID}`) !== null;
}

/** Remove a node if present, returning the cleared (absent) slot. */
function drop(node: Maybe<HTMLElement>): Maybe<HTMLElement> {
  node?.remove();
  return NONE;
}

/** Append a `<div>` (or the given tag) with a class to the overlay mount + return it. */
function add(overlay: Overlay, tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  overlay.mount.append(node);
  return node;
}

/** Position a fixed surface at a viewport point (the one dynamic, per-cursor value the CSS can't hold). */
function placeAt(node: HTMLElement, left: number, top: number): void {
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

/** The value of an overlay input by id, or "" when it is absent / not a field. */
function inputValue(id: string): string {
  const node = document.querySelector(`#${id}`);
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
    return node.value;
  }
  return "";
}

/** POST a finished report to the dev server's `/__vow/issue` endpoint (best-effort — a dev affordance). */
function send(report: Readonly<IssueReport>): void {
  fetch("/__vow/issue", {
    body: JSON.stringify(report),
    headers: { "content-type": "application/json" },
    method: "POST",
    // oxlint-disable-next-line promise/prefer-await-to-then -- fire-and-forget; a failed dev POST is swallowed
  }).catch(() => {
    // Best-effort: a failed dev POST never disrupts the app.
  });
}

/** Clear every live surface + leave pick mode — the overlay returns to idle (just the listeners). */
function teardown(overlay: Overlay): void {
  overlay.menu = drop(overlay.menu);
  overlay.highlight = drop(overlay.highlight);
  overlay.form = drop(overlay.form);
  overlay.picking = false;
}

/** The form's body — the kind heading, the element's source + route + hint, then the inputs + submit. */
function formMarkup(base: Readonly<Omit<IssueReport, "description" | "title">>): string {
  return [
    `<div class="r-head">${KIND_LABEL[base.kind]}</div>`,
    `<div class="r-meta">vow: ${base.source || "—"} · ${base.route} · ${base.element}</div>`,
    `<input id="${MOUNT_ID}-title" class="r-field" placeholder="Titel" />`,
    `<textarea id="${MOUNT_ID}-desc" class="r-field" placeholder="Beschreibung" rows="3"></textarea>`,
    `<button id="${MOUNT_ID}-send" class="r-send">Issue anlegen</button>`,
  ].join("");
}

/** Wire the form's submit — read the title + description, POST the report, and tear the overlay down. */
function wireForm(overlay: Overlay, base: Readonly<Omit<IssueReport, "description" | "title">>): void {
  document.querySelector(`#${MOUNT_ID}-send`)?.addEventListener("click", () => {
    send({
      ...base,
      description: inputValue(`${MOUNT_ID}-desc`),
      title: inputValue(`${MOUNT_ID}-title`) || KIND_LABEL[base.kind],
    });
    teardown(overlay);
  });
}

/** Build + show the report form for a picked element, pre-filled with its source + route, then wire it. */
function openForm(overlay: Overlay, el: Element): void {
  const base = {
    element: elementHint(el),
    kind: overlay.kind,
    route: globalThis.location.pathname,
    source: resolveVowSource(el),
  } as const;
  const form = add(overlay, "div", "r-surface r-form");
  placeAt(form, FORM_INSET, FORM_INSET);
  form.innerHTML = formMarkup(base);
  overlay.form = form;
  wireForm(overlay, base);
}

/** Enter pick mode for `kind`: a highlight box follows the hovered element; the next click selects it. */
function startPicking(overlay: Overlay, kind: IssueKind): void {
  overlay.menu = drop(overlay.menu);
  overlay.kind = kind;
  overlay.picking = true;
  overlay.highlight = add(overlay, "div", "r-highlight");
}

/** Position the highlight box over the element under the cursor while picking. */
function onMove(overlay: Overlay, event: MouseEvent): void {
  if (!overlay.picking || !overlay.highlight) {
    return;
  }
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (target === null || isOverlay(target)) {
    return;
  }
  const box = target.getBoundingClientRect();
  placeAt(overlay.highlight, box.left, box.top);
  overlay.highlight.style.width = `${box.width}px`;
  overlay.highlight.style.height = `${box.height}px`;
}

/** Capture the picked element on click (while picking), then open the report form over it. */
function onPick(overlay: Overlay, event: MouseEvent): void {
  if (!overlay.picking || isOverlay(event.target)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  overlay.highlight = drop(overlay.highlight);
  overlay.picking = false;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (target !== null) {
    openForm(overlay, target);
  }
}

/** One menu row — a labelled button that enters pick mode for its kind (the hover wash lives in CSS). */
function menuItem(overlay: Overlay, kind: IssueKind): HTMLElement {
  const item = document.createElement("button");
  item.className = "r-item";
  item.textContent = KIND_LABEL[kind];
  item.addEventListener("click", () => {
    startPicking(overlay, kind);
  });
  return item;
}

/** Open the "Bug melden / Feature vorschlagen" menu at the cursor; choosing one enters pick mode. */
function openMenu(overlay: Overlay, event: MouseEvent): void {
  teardown(overlay);
  const menu = add(overlay, "div", "r-surface r-menu");
  placeAt(menu, event.clientX, event.clientY);
  menu.append(menuItem(overlay, "bug"), menuItem(overlay, "feature"));
  overlay.menu = menu;
}

/** Wire the overlay's global listeners — right-click opens the menu, a move tracks the pick highlight, a
 *  click commits a pick, Escape / an outside pointer dismiss. Kept out of `setup` for the statement cap. */
function wireListeners(overlay: Overlay): void {
  document.addEventListener("contextmenu", (event) => {
    if (!isOverlay(event.target)) {
      event.preventDefault();
      openMenu(overlay, event);
    }
  });
  document.addEventListener("mousemove", (event) => {
    onMove(overlay, event);
  });
  document.addEventListener(
    "click",
    (event) => {
      onPick(overlay, event);
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      teardown(overlay);
    }
  });
  document.addEventListener("pointerdown", (event) => {
    const live = overlay.menu !== NONE || overlay.form !== NONE;
    if (!overlay.picking && live && !isOverlay(event.target)) {
      teardown(overlay);
    }
  });
}

/** Mount the overlay (its stylesheet + surface host) + wire the listeners. Idempotent — a second call is a
 *  no-op (the guard node). */
export function setupBugReporter(): void {
  if (document.querySelector(`#${MOUNT_ID}`) !== null) {
    return;
  }
  const mount = document.createElement("div");
  mount.id = MOUNT_ID;
  const style = document.createElement("style");
  style.textContent = OVERLAY_CSS;
  mount.append(style);
  document.body.append(mount);
  wireListeners({ form: NONE, highlight: NONE, kind: "bug", menu: NONE, mount, picking: false });
}
