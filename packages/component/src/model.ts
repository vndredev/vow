/**
 * vow's canonical component model — one framework-agnostic description, many adapters.
 *
 * A `Component` is plain data: optional doc/imports/props/events/setup + a `view` tree of `UiNode`s.
 * Bindings are carried as adapter-neutral **expression strings** (`expr: "item.done"`); each adapter
 * decides the surface syntax (Vue `v-bind=`/`:attr=`, React later `value`/`onChange`). The expression
 * is the agnostic seam — the syntax is the adapter's job. `renderVueSfc` (render-vue.ts) is the first
 * adapter; React/Solid are later additions over this same model. The model grows field-by-field as
 * each migration step earns the field — it stays minimal by design.
 */

/** A component prop: a name + its TS type expression (e.g. "boolean", "Task[]"). */
export interface PropDef {
  readonly name: string;
  readonly tsType: string;
  readonly optional?: boolean;
  /** A default value expression (verbatim TS, e.g. "4" or "'row'") — rendered via `withDefaults`. */
  readonly default?: string;
}

/** An emitted event: a name + its payload tuple inner (e.g. payload "boolean" → `[boolean]`). */
export interface EventDef {
  readonly name: string;
  readonly payload: string;
}

/** A module import: a default binding and/or named bindings from a module specifier. */
export interface ImportDecl {
  readonly from: string;
  readonly names?: readonly string[];
  readonly default?: string;
}

/** A static attribute — a literal value written verbatim into the markup. */
export interface StaticAttr {
  readonly kind: "static";
  readonly name: string;
  readonly value: string;
}

/** A bound attribute — an adapter-neutral expression the adapter renders in its own syntax. */
export interface BoundAttr {
  readonly kind: "bound";
  readonly name: string;
  readonly expr: string;
}

/** A spread of a dynamic props object (the headless seam): Vue → `v-bind="<expr>"`. */
export interface SpreadAttr {
  readonly kind: "spread";
  readonly expr: string;
}

/** An event handler — an expression run on a DOM/component event, with optional modifiers. */
export interface EventAttr {
  readonly kind: "event";
  readonly name: string;
  readonly expr: string;
  readonly modifiers?: readonly string[];
}

/** A two-way binding (Vue's v-model), with optional modifiers (e.g. `number`). */
export interface ModelAttr {
  readonly kind: "model";
  readonly expr: string;
  readonly modifiers?: readonly string[];
}

/**
 * A conditional render: the node is present only when `expr` is truthy. `if` mounts/unmounts the node
 * (Vue's `v-if`, gone from the DOM + tab order when false); `show` only toggles visibility (`v-show`,
 * `display:none` but kept mounted). The agnostic seam holds — a React adapter maps `if` to
 * `{expr && (…)}` and `show` to a `style.display` toggle.
 */
export interface ConditionalAttr {
  readonly kind: "cond";
  readonly type: "if" | "show";
  readonly expr: string;
}

export type Attr = StaticAttr | BoundAttr | SpreadAttr | EventAttr | ModelAttr | ConditionalAttr;

/** A loop over a node (Vue's `v-for`): the node renders once per item, with an optional `:key`. */
export interface Loop {
  readonly each: string; // the iterable expression, e.g. "rows"
  readonly as: string; // the item binding, e.g. "item"
  readonly index?: string; // the index binding, e.g. "i"
  readonly key?: string; // the :key expression, e.g. "i"
}

/** An HTML element node. `inline` keeps children on one line (e.g. `<select>` with `<option>`s). */
export interface ElementNode {
  readonly kind: "element";
  readonly tag: string;
  readonly attrs: readonly Attr[];
  readonly children: readonly UiNode[];
  readonly for?: Loop;
  readonly inline?: boolean;
}

/** Another component, referenced by PascalCase name (e.g. `<Checkbox>`). */
export interface ComponentNode {
  readonly kind: "component";
  readonly name: string;
  readonly attrs: readonly Attr[];
  readonly children: readonly UiNode[];
  readonly for?: Loop;
}

/** A literal text node — escaped verbatim into the markup. */
export interface TextNode {
  readonly kind: "text";
  readonly text: string;
}

/** An interpolation node — an adapter-neutral expression rendered as the framework's interpolation. */
export interface InterpNode {
  readonly kind: "interp";
  readonly expr: string;
}

/** A slot outlet (Vue's `<slot>`). `name` absent = the default slot; `children` = fallback content. */
export interface SlotNode {
  readonly kind: "slot";
  readonly name?: string;
  /** A dynamic slot name expression (Vue `:name="<expr>"`) — e.g. a `v-for` of named panels. */
  readonly nameExpr?: string;
  readonly children: readonly UiNode[];
}

/**
 * A raw HTML escape hatch — `html` is emitted verbatim into the markup (no escaping, no parsing). For
 * build-time-trusted, already-rendered HTML with no structured-node equivalent: syntax-highlighted code
 * (Shiki), an embedded SVG. Deterministic in → byte-stable out. A React adapter maps it to
 * `dangerouslySetInnerHTML`. The escape hatch for prose, kept rare on purpose.
 */
export interface RawNode {
  readonly kind: "raw";
  readonly html: string;
}

export type UiNode = ElementNode | ComponentNode | TextNode | InterpNode | SlotNode | RawNode;

/** The canonical, framework-agnostic component. Grows field-by-field as each step earns it. */
export interface Component {
  readonly name: string;
  readonly doc?: readonly string[];
  readonly imports?: readonly ImportDecl[];
  readonly props?: readonly PropDef[];
  readonly events?: readonly EventDef[];
  /** Raw setup-script lines — the framework-glue escape hatch (e.g. the headless `computed(...)`). */
  readonly setup?: readonly string[];
  readonly view: UiNode;
}
