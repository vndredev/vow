---
group: UI
order: 4
---

# The component model

Vue, React and Solid are **three dialects of the same essence**: a component has props, events, and a tree of markup. vow captures that essence **once** as plain data — the `Component` model — and a per-framework **adapter** renders it. Vue is the full adapter (`renderVueSfc`); a **second, stateless React adapter** (`renderReactSfc` / `renderReactView`) has already shipped — a byte-stable, test-pinned renderer over the _same_ model, not a rewrite. It proves the model is framework-neutral: one spec, more than one target.

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
  setup?: (SetupStep | string)[]; // a structured step OR a raw Vue line (the escape hatch)
  view: UiNode; // the markup tree
}

type SetupStep =
  | { kind: "state"; name: string; init: string } // ref(init) / useState(init)
  | { kind: "computed"; name: string; expr: string; deps?: string[] } // computed(()=>) / useMemo
  | { kind: "handler"; name: string; params: string; body: string[] } // function / arrow
  | { kind: "const"; name: string; expr: string }; // const name = expr (identical everywhere)

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

## Setup: a structured, framework-neutral model

The `setup` list is the script body, item by item. A raw `string` is the **escape hatch** — verbatim Vue (e.g. the headless `computed(...)`) that only the Vue adapter can render. A `SetupStep` is the **structured** alternative: a typed primitive — `state`, `computed`, `handler`, `const` — that carries _intent_, not syntax, so **each adapter renders it into its own idiom**. The Vue adapter renders `state` → `const x = ref(init)`, `computed` → `computed(() => expr)`, `handler` → a `function`; the React adapter renders the SAME step → `useState`, `useMemo`, an arrow. A `const` is the framework-neutral base case — identical everywhere. This is the seam that lets a second adapter consume the same setup the first one does; a step is a type error in both adapters until each is given an idiom, never a silent half-feature.

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

The expression (`"label"`, `"api.rootProps"`) is the **seam**: the model says _what_ to bind, the adapter decides the _syntax_. Vue renders `:aria-label="label"`; the React adapter renders `aria-label={label}`. The model never learns a Vue keyword.

## One model, many adapters

`renderVueSfc(component): string` is the Vue adapter — an exhaustive walk over the discriminated unions (a missing node kind is a type error, so drift is a red build). Its output is **byte-stable**, pinned by an equality test against the original hand-written SFC.

`renderReactSfc(component): string` is the **second adapter** over the same `Component` — no model change. It walks the _same_ `UiNode` tree (`renderReactView`) into JSX: `class` becomes `className`, `:aria-label="label"` becomes `aria-label={label}`, `@click="add"` becomes `onClick={() => add}`, `v-if` becomes `{expr && (…)}`, a loop becomes `{each.map((as) => …)}`. It also renders the shell: `props` become a destructured typed parameter, `events` become `on<Pascal>` callback props, and a **structured `setup`** (a `SetupStep` list) renders into React hooks — `state` → `useState`, `computed` → `useMemo`, `handler` → an arrow, `const` verbatim. Its output is **byte-stable** too, pinned by its own equality test. The scope is now stateless _and_ simple-stateful; the one narrow gap left for the **#101** follow-up is a **raw setup string** (verbatim Vue, untranslatable) — and the `model` / `spread` / `raw` attr kinds — which throw loudly rather than render half a feature. No emitter targets React yet — generation is still Vue end-to-end; the React adapter exists to **prove** the model is framework-neutral, one renderer at a time.

::: warning Foundation status
Emitters build Components and render them via `renderVueSfc`: the primitives (`@vow/emit-primitive`), the entity lists + forms (`@vow/emit-view`), the layout primitives (`@vow/layout`). This is **gated** — an emitter that writes a raw `<template>` string instead of the model fails the build (`@vow/gate`'s framework-neutrality test), so a single-framework hardcode can't slip in; a short, shrinking allowlist tracks the few remaining hand-written SFCs (the live issue views + the changelog timeline). The generators target Vue end-to-end; the **React adapter** (`renderReactSfc` / `renderReactView`) is the second renderer over the same IR — shipped, byte-stable, and test-pinned — but it stays a proof, not a generation target: it now renders structured-setup stateful components into hooks, while a raw setup string still throws as the narrowed #101 follow-up, and no emitter emits React yet. The existing Vue emitters keep their raw-string setups, so their SFC output is byte-identical. Solid would be a further adapter over the same model, with no change to the IR.
:::
