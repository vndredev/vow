# The component model

Vue, React and Solid are **three dialects of the same essence**: a component has props, events, and a tree of markup. vow captures that essence **once** as plain data — the `Component` model — and a per-framework **adapter** renders it. Today there is one adapter (`renderVueSfc`); React/Solid are later additions over the _same_ model, not a rewrite.

This is why the emitters don't hand-write Vue strings: an `emit view` or a primitive builds a `Component`, and the adapter turns it into an SFC. One model, many targets.

## The model

A `Component` is plain data (`@vow/component`):

```ts
interface Component {
  name: string;
  doc?: string[]; // leading comment lines
  imports?: ImportDecl[]; // { from, names?, default? }
  props?: PropDef[]; // { name, tsType, optional? }
  events?: EventDef[]; // { name, payload }
  setup?: string[]; // framework-glue escape hatch (e.g. the headless computed(...))
  view: UiNode; // the markup tree
}

type UiNode =
  | { kind: "element"; tag: string; attrs: Attr[]; children: UiNode[] }
  | { kind: "component"; name: string; attrs: Attr[]; children: UiNode[] }
  | { kind: "text"; text: string } // an escaped literal
  | { kind: "interp"; expr: string }; // an interpolated expression
```

## The agnostic seam: bindings are expression strings

An attribute is **static**, **bound**, or a **spread** — and a binding carries an adapter-neutral _expression_, never framework syntax:

```ts
type Attr =
  | { kind: "static"; name: string; value: string } // class="vow-checkbox"
  | { kind: "bound"; name: string; expr: string } // :aria-label="label"
  | { kind: "spread"; expr: string } // v-bind="api.rootProps"
  | { kind: "event"; name: string; expr: string; modifiers?: string[] } // @submit.prevent="add"
  | { kind: "model"; expr: string; modifiers?: string[] }; // v-model.number="draft.x"
```

The expression (`"label"`, `"api.rootProps"`) is the **seam**: the model says _what_ to bind, the adapter decides the _syntax_. Vue renders `:aria-label="label"`; a future React adapter renders `aria-label={label}`. The model never learns a Vue keyword.

## One model, many adapters

`renderVueSfc(component): string` is the Vue adapter — an exhaustive walk over the discriminated unions (a missing node kind is a type error, so drift is a red build). Its output is **byte-stable**, pinned by an equality test against the original hand-written SFC. Adding React later means writing `renderReact(component)` over the same `Component` — no model change.

::: warning Foundation status
The model and the Vue adapter exist and are proven (`renderVueSfc` reproduces the checkbox SFC byte-for-byte). The emitters are being moved onto the model **one at a time** — see the [roadmap](/guide/roadmap). `state`, named slots, loops and event handlers grow with the step that first needs them; React/Solid adapters are later.
:::
