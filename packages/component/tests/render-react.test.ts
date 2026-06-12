import type { Component, UiNode } from "../src/model.ts";
import { expect, test } from "vite-plus/test";
import { renderReactSfc, renderReactView } from "../src/index.ts";

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

test("an event attr becomes a React handler prop: @click -> onClick={() => add}", () => {
  const node: UiNode = {
    attrs: [{ expr: "add(item)", kind: "event", name: "click" }],
    children: [{ kind: "text", text: "Add" }],
    kind: "element",
    tag: "button",
  };
  expect(renderReactView(node, 0)).toBe(`<button onClick={() => add(item)}>Add</button>`);
});

test("a multi-word event capitalizes only the first letter: dragstart -> onDragStart", () => {
  const node: UiNode = {
    attrs: [{ expr: "pick(item)", kind: "event", name: "dragstart" }],
    children: [],
    kind: "component",
    name: "Card",
  };
  expect(renderReactView(node, 0)).toBe(`<Card onDragStart={() => pick(item)} />`);
});

test("a v-if conditional wraps the node as {expr && (node)}", () => {
  const node: UiNode = {
    attrs: [
      { expr: "open", kind: "cond", type: "if" },
      { kind: "static", name: "class", value: "panel" },
    ],
    children: [{ kind: "text", text: "hi" }],
    kind: "element",
    tag: "p",
  };
  const expected = [`{open && (`, `  <p className="panel">hi</p>`, `)}`].join("\n");
  expect(renderReactView(node, 0)).toBe(expected);
});

test("a v-for loop maps the node and keys the inner element's opener", () => {
  const node: UiNode = {
    attrs: [{ kind: "static", name: "class", value: "row" }],
    children: [{ expr: "row.title", kind: "interp" }],
    for: { as: "row", each: "rows", key: "row.id" },
    kind: "element",
    tag: "li",
  };
  const expected = [
    `{rows.map((row) => (`,
    `  <li className="row" key={row.id}>{row.title}</li>`,
    `))}`,
  ].join("\n");
  expect(renderReactView(node, 0)).toBe(expected);
});

test("a v-for + v-if nests loop-outermost, conditional inside, deepening the element", () => {
  const node: UiNode = {
    attrs: [{ expr: "row.show", kind: "cond", type: "if" }],
    children: [{ expr: "row.title", kind: "interp" }],
    for: { as: "row", each: "rows", key: "row.id" },
    kind: "element",
    tag: "li",
  };
  const expected = [
    `{rows.map((row) => (`,
    `  {row.show && (`,
    `    <li key={row.id}>{row.title}</li>`,
    `  )}`,
    `))}`,
  ].join("\n");
  expect(renderReactView(node, 0)).toBe(expected);
});

test("a slot outlet maps to React's universal {children} prop", () => {
  const node: UiNode = { children: [], kind: "slot", name: "header" };
  expect(renderReactView(node, 0)).toBe(`{children}`);
});

test("an out-of-scope attribute kind (model) throws — a #101 follow-up, not a half-feature", () => {
  const node: UiNode = {
    attrs: [{ expr: "draft.name", kind: "model" }],
    children: [],
    kind: "element",
    tag: "input",
  };
  expect(() => renderReactView(node, 0)).toThrow("out of scope");
});

test("an out-of-scope node kind (raw) throws", () => {
  const node: UiNode = { html: "<svg/>", kind: "raw" };
  expect(() => renderReactView(node, 0)).toThrow("out of scope");
});

// A stateless presentational Component (imports + a view, no setup/props/events) — the in-scope shell.
// Exercises a default import, a named import, and the view wrapped at depth 2 (function body + return).
// The expected string is the byte-exact .tsx oracle; a render change is a red test, not silent drift.
const card: Component = {
  imports: [
    { default: "Badge", from: "./Badge.tsx" },
    { from: "./icons.ts", names: ["Star"] },
  ],
  name: "Card",
  view: {
    attrs: [{ kind: "static", name: "class", value: "card" }],
    children: [
      {
        attrs: [{ expr: "status", kind: "bound", name: "label" }],
        children: [],
        kind: "component",
        name: "Badge",
      },
      {
        attrs: [],
        children: [{ kind: "text", text: "Hello" }],
        kind: "element",
        tag: "p",
      },
    ],
    kind: "element",
    tag: "div",
  },
};

const EXPECTED_CARD = [
  `import Badge from "./Badge.tsx";`,
  `import { Star } from "./icons.ts";`,
  `export default function Card() {`,
  `  return (`,
  `    <div className="card">`,
  `      <Badge label={status} />`,
  `      <p>Hello</p>`,
  `    </div>`,
  `  );`,
  `}`,
  ``,
].join("\n");

test("renderReactSfc renders a stateless component to a .tsx shell byte-for-byte", () => {
  expect(renderReactSfc(card)).toBe(EXPECTED_CARD);
});

// A simple-stateful Component whose setup is STRUCTURED (a SetupStep list, not raw Vue strings).
// State, a derived value, and a handler, plus a prop and an event. The React adapter renders the
// SAME model the Vue adapter does, only into hooks (state -> useState, computed -> useMemo) with the
// Handler an arrow, the prop a destructured param, the event an on<Pascal> callback. Byte-exact oracle.
const counter: Component = {
  events: [{ name: "update:modelValue", payload: "number" }],
  imports: [{ from: "react", names: ["useMemo", "useState"] }],
  name: "Counter",
  props: [{ default: "0", name: "step", optional: true, tsType: "number" }],
  setup: [
    { init: "0", kind: "state", name: "count" },
    { deps: ["count"], expr: "count * 2", kind: "computed", name: "doubled" },
    {
      body: ["setCount(count + step);", "onUpdateModelValue(count + step);"],
      kind: "handler",
      name: "bump",
      params: "",
    },
  ],
  view: {
    attrs: [{ expr: "bump", kind: "event", name: "click" }],
    children: [{ expr: "doubled", kind: "interp" }],
    kind: "element",
    tag: "button",
  },
};

const EXPECTED_COUNTER = [
  `import { useMemo, useState } from "react";`,
  `export default function Counter({ step = 0, onUpdateModelValue }: { step?: number; onUpdateModelValue: (payload: number) => void }) {`,
  `  const [count, setCount] = useState(0);`,
  `  const doubled = useMemo(() => count * 2, [count]);`,
  `  const bump = () => {`,
  `    setCount(count + step);`,
  `    onUpdateModelValue(count + step);`,
  `  };`,
  ``,
  `  return (`,
  `    <button onClick={() => bump}>{doubled}</button>`,
  `  );`,
  `}`,
  ``,
].join("\n");

test("renderReactSfc renders a structured-setup component into React hooks byte-for-byte", () => {
  expect(renderReactSfc(counter)).toBe(EXPECTED_COUNTER);
});

test("a const step renders identically in both adapters (the framework-neutral base case)", () => {
  const greeting: Component = {
    name: "Greeting",
    props: [{ name: "label", tsType: "string" }],
    setup: [{ expr: "'Hi, ' + label", kind: "const", name: "greeting" }],
    view: {
      attrs: [],
      children: [{ expr: "greeting", kind: "interp" }],
      kind: "element",
      tag: "p",
    },
  };
  const expected = [
    `export default function Greeting({ label }: { label: string }) {`,
    `  const greeting = 'Hi, ' + label;`,
    ``,
    `  return (`,
    `    <p>{greeting}</p>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
  expect(renderReactSfc(greeting)).toBe(expected);
});

test("renderReactSfc narrows its throw to a RAW setup string (the #101 follow-up), not the feature", () => {
  // A structured setup renders; only the verbatim-Vue escape hatch (a raw string) stays untranslatable.
  const stateful: Component = {
    name: "Legacy",
    setup: ["const api = computed(() => something);"],
    view: { attrs: [], children: [], kind: "element", tag: "div" },
  };
  expect(() => renderReactSfc(stateful)).toThrow("#101 follow-up");
});

test("a bound attr name that would forge a directive is rejected in the React adapter (#305)", () => {
  // The same breakout as the Vue path — the second renderer over the model rejects it identically.
  const node: UiNode = {
    attrs: [{ expr: "doEvil()", kind: "bound", name: 'class="x" @click' }],
    children: [],
    kind: "component",
    name: "Card",
  };
  expect(() => renderReactView(node, 0)).toThrow(/not a safe attribute name/u);
});

test("a legitimate bound attr name still renders byte-stable in the React adapter", () => {
  const node: UiNode = {
    attrs: [{ expr: "label", kind: "bound", name: "aria-label" }],
    children: [],
    kind: "component",
    name: "Field",
  };
  expect(renderReactView(node, 0)).toBe(`<Field aria-label={label} />`);
});
