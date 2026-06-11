// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import { internalLink } from "../src/index.ts";

/** Derived from `internalLink`'s own signature so the test keeps a single value import from the source
 *  under test (a separate type import from the same module is forbidden by the import rules). */
type ClickEvent = Parameters<typeof internalLink>[0];

/** `internalLink` only RESOLVES a click; preventing the default is `onClick`'s job. So the base's
 *  `preventDefault` throws — if any case trips it, `internalLink` stopped being pure and the suite
 *  fails loudly rather than passing a hidden side effect. */
function mustNotPrevent(): never {
  throw new Error("internalLink must not preventDefault — that is onClick's job");
}

/** The plain (non-modifier, primary-button, not-yet-prevented) base of a click — overridden per case
 *  so each test states only what differs. This suite asks `internalLink` what the router WOULD do; it
 *  does not drive the listener. */
const plain = {
  altKey: false,
  button: 0,
  ctrlKey: false,
  defaultPrevented: false,
  metaKey: false,
  preventDefault: mustNotPrevent,
  shiftKey: false,
} satisfies Omit<ClickEvent, "target">;

/** Build a click whose target is a real anchor with the given href and attributes. */
function clickOn(href: string, attrs: Readonly<Record<string, string>> = {}): ClickEvent {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  for (const [name, value] of Object.entries(attrs)) {
    anchor.setAttribute(name, value);
  }
  return { ...plain, target: anchor };
}

test("a plain internal click resolves to an in-app link", () => {
  const link = internalLink(clickOn("/guide/emit#fields"));
  expect(link?.pathname).toBe("/guide/emit");
  expect(link?.hash).toBe("#fields");
});

test("Cmd/Ctrl/Shift/Alt+Click is left to the browser (open in new tab/window)", () => {
  const href = "/guide/emit";
  expect(internalLink({ ...clickOn(href), metaKey: true })).toBeUndefined();
  expect(internalLink({ ...clickOn(href), ctrlKey: true })).toBeUndefined();
  expect(internalLink({ ...clickOn(href), shiftKey: true })).toBeUndefined();
  expect(internalLink({ ...clickOn(href), altKey: true })).toBeUndefined();
});

test("a non-primary (e.g. middle) button is left to the browser", () => {
  expect(internalLink({ ...clickOn("/guide/emit"), button: 1 })).toBeUndefined();
});

test("an already-prevented click is left as handled", () => {
  expect(internalLink({ ...clickOn("/guide/emit"), defaultPrevented: true })).toBeUndefined();
});

test("download and rel=external anchors are left to the browser", () => {
  expect(internalLink(clickOn("/files/report.pdf", { download: "" }))).toBeUndefined();
  expect(internalLink(clickOn("/elsewhere", { rel: "external" }))).toBeUndefined();
  expect(internalLink(clickOn("/elsewhere", { rel: "noopener external" }))).toBeUndefined();
});

test("target=_blank and clicks outside any anchor are left to the browser", () => {
  expect(internalLink(clickOn("/guide/emit", { target: "_blank" }))).toBeUndefined();
  expect(internalLink({ ...plain, target: document.createElement("div") })).toBeUndefined();
});
