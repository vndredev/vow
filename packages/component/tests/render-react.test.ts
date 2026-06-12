import { expect, test } from "vite-plus/test";
import type { UiNode } from "../src/model.ts";
import { renderReactView } from "../src/index.ts";

// A fixture exercising every in-scope React-adapter case in one tree.
// Covers an element host with a renamed class -> className static attr plus a bound attr.
// Covers a nested inline element with escaped text and a self-closing PascalCase component.
// The component carries a for -> htmlFor rename; the void element self-closes; the last element mixes text + interp.
// The expected string is the byte-exact oracle — a render change is a red test, not a silent drift.
const view: UiNode = {
  attrs: [
    { kind: "static", name: "class", value: "card" },
    { expr: "cardId", kind: "bound", name: "id" },
  ],
  children: [
    {
      attrs: [{ kind: "static", name: "class", value: "title" }],
      children: [{ kind: "text", text: "a < b & c" }],
      kind: "element",
      tag: "h1",
    },
    {
      attrs: [
        { expr: "status", kind: "bound", name: "label" },
        { kind: "static", name: "for", value: "field" },
      ],
      children: [],
      kind: "component",
      name: "Badge",
    },
    {
      attrs: [
        { kind: "static", name: "class", value: "in" },
        { expr: "draft.x", kind: "bound", name: "value" },
      ],
      children: [],
      kind: "element",
      tag: "input",
    },
    {
      attrs: [],
      children: [
        { kind: "text", text: "Count: " },
        { expr: "count", kind: "interp" },
      ],
      kind: "element",
      tag: "p",
    },
  ],
  kind: "element",
  tag: "div",
};

const EXPECTED = [
  `<div className="card" id={cardId}>`,
  `  <h1 className="title">a &lt; b &amp; c</h1>`,
  `  <Badge label={status} htmlFor="field" />`,
  `  <input className="in" value={draft.x} />`,
  `  <p>Count: {count}</p>`,
  `</div>`,
].join("\n");

test("renderReactView renders the in-scope UiNode tree to JSX byte-for-byte", () => {
  expect(renderReactView(view, 0)).toBe(EXPECTED);
});

test("a text leaf is HTML-escaped (& < > in order)", () => {
  const node: UiNode = { kind: "text", text: "x < y & z > w" };
  expect(renderReactView(node, 0)).toBe("x &lt; y &amp; z &gt; w");
});

test("an interp leaf becomes JSX's {expr}", () => {
  const node: UiNode = { expr: "item.title", kind: "interp" };
  expect(renderReactView(node, 0)).toBe("{item.title}");
});

test("an out-of-scope node kind (slot) throws — a #101 follow-up, not a half-feature", () => {
  const node: UiNode = { children: [], kind: "slot", name: "header" };
  expect(() => renderReactView(node, 0)).toThrow("out of scope");
});

test("an out-of-scope attribute kind (event) throws", () => {
  const node: UiNode = {
    attrs: [{ expr: "add", kind: "event", name: "click" }],
    children: [],
    kind: "element",
    tag: "button",
  };
  expect(() => renderReactView(node, 0)).toThrow("out of scope");
});
