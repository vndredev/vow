import type { Component, EventDef, PropDef, SetupStep } from "./model.ts";
import { defined } from "./defined.ts";
import { pascalCase } from "./naming.ts";
import { reactSetupStep } from "./render-setup.ts";
import { renderImport } from "./render-script.ts";
import { renderReactView } from "./render-react.ts";

/**
 * The React adapter SHELL — render a canonical `Component` into a React SFC (`.tsx`) string. The
 * sibling of `renderVueSfc` (render-vue.ts): it renders the component's imports, then wraps the view
 * (via the proven `renderReactView`, render-react.ts) in a default-exported function component. Output
 * is **byte-stable** — pinned by an equality test, so a render change is a red test, not silent drift.
 *
 * Scope covers stateless components AND simple-stateful ones whose setup is **structured** (a list of
 * `SetupStep`s — state/computed/handler/const — each rendered into React hooks by `reactSetupStep`),
 * with `props` as a destructured typed parameter and `events` as `on<Pascal>` callback props. The one
 * narrow gap left for the #101 follow-up: a RAW setup string (verbatim Vue, untranslatable) throws —
 * the throw is narrowed to exactly that item, never the whole feature.
 */

/** Indent depth of the view: one level for the function body, one for the `return (` block. */
const VIEW_DEPTH = 2;

/** One indent level — the function body sits one level inside `export default function`. */
const INDENT = "  ";

/** A `<slug>` event name to its React callback prop: `update:modelValue` -> `onUpdateModelValue`. */
function eventPropName(name: string): string {
  const slug = name.replaceAll(/[^A-Za-z0-9]+/gu, "-");
  return `on${pascalCase(slug)}`;
}

/** One event as a destructured callback prop with its `(payload) => void` type, e.g. `onClick`. */
function eventField(event: EventDef): { readonly name: string; readonly type: string } {
  const name = eventPropName(event.name);
  return { name, type: `${name}: (payload: ${event.payload}) => void` };
}

/** One prop as a destructured binding (with a React default) + its type field (optional via `?`). */
function propField(prop: PropDef): { readonly binding: string; readonly type: string } {
  let binding = prop.name;
  if (defined(prop.default)) {
    binding = `${prop.name} = ${prop.default}`;
  }
  let optional = "";
  if (prop.optional === true) {
    optional = "?";
  }
  return { binding, type: `${prop.name}${optional}: ${prop.tsType}` };
}

/** The destructured parameter list: props bindings then event callbacks, e.g. `{ label, onClick }`. */
function paramBindings(props: readonly PropDef[], events: readonly EventDef[]): string {
  const bindings = [
    ...props.map((prop) => propField(prop).binding),
    ...events.map((event) => eventPropName(event.name)),
  ];
  return `{ ${bindings.join(", ")} }`;
}

/** The inline parameter type: prop fields then event fields, e.g. `{ label: string; onClick: ... }`. */
function paramType(props: readonly PropDef[], events: readonly EventDef[]): string {
  const fields = [
    ...props.map((prop) => propField(prop).type),
    ...events.map((event) => eventField(event).type),
  ];
  return `{ ${fields.join("; ")} }`;
}

/** The function signature: bare `Name()` when stateless, else `Name(params: type)`. */
function signature(component: Component): string {
  const props = component.props ?? [];
  const events = component.events ?? [];
  if (props.length === 0 && events.length === 0) {
    return `export default function ${component.name}() {`;
  }
  return `export default function ${component.name}(${paramBindings(props, events)}: ${paramType(props, events)}) {`;
}

/** True for a structured step — a raw `string` setup item is the verbatim-Vue escape hatch instead. */
function isStep(item: SetupStep | string): item is SetupStep {
  return typeof item !== "string";
}

/** The code text a step carries that a `.value` access could hide in — its init/expr/body fragments. */
function stepCode(step: SetupStep): readonly string[] {
  if (step.kind === "state") {
    return [step.init];
  }
  if (step.kind === "computed") {
    return [step.expr];
  }
  if (step.kind === "handler") {
    return step.body;
  }
  return [step.expr];
}

/** True for a step that DECLARES a reactive binding — `state`/`computed`, read as `x.value` in Vue. */
function declaresReactive(step: SetupStep): boolean {
  return step.kind === "state" || step.kind === "computed";
}

/** A regex matching `<name>.value` on a word boundary — `count.value`, never `e.target.value`. */
function dotValueOf(name: string): RegExp {
  return new RegExp(`\\b${name}\\.value\\b`, "u");
}

/**
 * Guard the setup against Vue-idiom `.value` reads of a DECLARED reactive binding — interim until state
 * references are structured (the seam where one setup model truly serves both adapters). The Vue adapter
 * reads `count.value`; React reads `count`, so `count.value` would silently become `undefined.value`
 * (NaN). We throw loudly, scoped to declared `state`/`computed` names only (`e.target.value` stays legit
 * DOM code).
 */
function assertNoDeclaredDotValue(steps: readonly SetupStep[]): void {
  const reactiveNames = steps.filter((step) => declaresReactive(step)).map((step) => step.name);
  const fragments = steps.flatMap((step) => [...stepCode(step)]);
  for (const name of reactiveNames) {
    const pattern = dotValueOf(name);
    if (fragments.some((fragment) => pattern.test(fragment))) {
      throw new Error(
        `component: setup reads "${name}.value" — Vue-idiom state untranslatable to React (a #101 follow-up)`,
      );
    }
  }
}

/** One setup item as React lines: a `SetupStep` via `reactSetupStep`; a raw string is the narrow throw. */
function reactSetupItem(item: SetupStep | string): readonly string[] {
  if (isStep(item)) {
    return reactSetupStep(item);
  }
  throw new Error(
    `component: a raw setup string is verbatim Vue, untranslatable to React — "${item}" (a #101 follow-up)`,
  );
}

/** The setup section as indented React lines, in author order, plus a trailing blank line when present. */
function renderReactSetup(setup: readonly (SetupStep | string)[]): string[] {
  if (setup.length === 0) {
    return [];
  }
  assertNoDeclaredDotValue(setup.filter((item) => isStep(item)));
  const lines = setup.flatMap((item) => [...reactSetupItem(item)]);
  return [...lines.map((line) => `${INDENT}${line}`), ``];
}

/** Render a `Component` to a React SFC string; a raw setup string throws (the narrowed #101 follow-up). */
export function renderReactSfc(component: Component): string {
  return [
    ...(component.imports ?? []).map((decl) => renderImport(decl)),
    signature(component),
    ...renderReactSetup(component.setup ?? []),
    `${INDENT}return (`,
    renderReactView(component.view, VIEW_DEPTH),
    `${INDENT});`,
    `}`,
    ``,
  ].join("\n");
}
