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
}

/** An emitted event: a name + its payload tuple inner (e.g. payload "boolean" → `[boolean]`). */
export interface EventDef {
  readonly name: string;
  readonly payload: string;
}

/** A module import: the named bindings pulled from a module specifier. */
export interface ImportDecl {
  readonly from: string;
  readonly names: readonly string[];
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

export type Attr = StaticAttr | BoundAttr | SpreadAttr;

/** An HTML element node. */
export interface ElementNode {
  readonly kind: "element";
  readonly tag: string;
  readonly attrs: readonly Attr[];
  readonly children: readonly UiNode[];
}

/** Another component, referenced by PascalCase name (e.g. `<Checkbox>`). */
export interface ComponentNode {
  readonly kind: "component";
  readonly name: string;
  readonly attrs: readonly Attr[];
  readonly children: readonly UiNode[];
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

export type UiNode = ElementNode | ComponentNode | TextNode | InterpNode;

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
