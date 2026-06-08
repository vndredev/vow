---
group: UI
order: 4
---

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
  props?: PropDef[]; // { name, tsType, optional?, default? }
  events?: EventDef[]; // { name, payload }
  setup?: string[]; // framework-glue escape hatch (e.g. the headless computed(...))
  view: UiNode; // the markup tree
}

type UiNode =
  | {
      kind: "element";
      tag: string;
      attrs: Attr[];
      children: UiNode[];
      for?: Loop;
      inline?: boolean;
    } // for? = v-for; inline keeps children on one line
  | { kind: "component"; name: string; attrs: Attr[]; children: UiNode[]; for?: Loop }
  | { kind: "text"; text: string } // an escaped literal
  | { kind: "interp"; expr: string } // an interpolated expression
  | { kind: "slot"; name?: string; nameExpr?: string; children: UiNode[] } // <slot>; nameExpr = :name="expr"
  | { kind: "raw"; html: string }; // verbatim trusted HTML (Shiki, SVG) — the prose escape hatch
```

A prop may carry a `default` (a verbatim TS expression); when any prop has one, the adapter emits `withDefaults(defineProps<…>(), { … })` instead of the bare `defineProps`. A `"slot"` node is a slot outlet — `<slot />`, `<slot name="x" />`, or `<slot>fallback</slot>` — the seam a layout shell uses to receive content.

## The agnostic seam: bindings are expression strings

An attribute is **static**, **bound**, a **spread**, an **event** handler, a **model** binding, or a **conditional** (`v-if`/`v-show`) — and a dynamic one carries an adapter-neutral _expression_, never framework syntax:

```ts
type Attr =
  | { kind: "static"; name: string; value: string } // class="vow-checkbox"
  | { kind: "bound"; name: string; expr: string } // :aria-label="label"
  | { kind: "spread"; expr: string } // v-bind="api.rootProps"
  | { kind: "event"; name: string; expr: string; modifiers?: string[] } // @submit.prevent="add"
  | { kind: "model"; expr: string; modifiers?: string[] } // v-model.number="draft.x"
  | { kind: "cond"; type: "if" | "show"; expr: string }; // v-if="open" / v-show="open"
```

The expression (`"label"`, `"api.rootProps"`) is the **seam**: the model says _what_ to bind, the adapter decides the _syntax_. Vue renders `:aria-label="label"`; a future React adapter renders `aria-label={label}`. The model never learns a Vue keyword.

## One model, many adapters

`renderVueSfc(component): string` is the Vue adapter — an exhaustive walk over the discriminated unions (a missing node kind is a type error, so drift is a red build). Its output is **byte-stable**, pinned by an equality test against the original hand-written SFC. Adding React later means writing `renderReact(component)` over the same `Component` — no model change.

::: warning Foundation status
Every emitter builds Components and renders them via `renderVueSfc`: the primitives (`@vow/emit-primitive`), the entity lists + forms (`@vow/emit-view`), the layout primitives (`@vow/layout`). Vue is the only adapter today — React or Solid would be a new `renderReact` over the same model, with no change to the IR.
:::
