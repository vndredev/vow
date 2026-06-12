import type { HandlerStep, SetupStep } from "./model.ts";

/**
 * Render a structured `SetupStep` into a framework's setup lines — the seam that lets every adapter
 * share ONE setup model. The Vue adapter renders a step into composition-API lines (`ref`, `computed`,
 * `function`); the React adapter renders the SAME step into hooks (`useState`, `useMemo`, an arrow). A
 * raw `string` setup item is NOT a step — it is the verbatim escape hatch each caller handles on its
 * own (Vue renders it as-is; React narrows its throw to exactly it).
 *
 * Both adapters live here so the two renderings stay side by side, provably over one union — a new step
 * is a type error in both functions until each is given an idiom, never a silent half-feature.
 */

const INDENT = "  ";

/** Body lines indented one level, framing the `{ ... }` of a handler — shared by both adapters. */
function indentBody(body: readonly string[]): string[] {
  return body.map((line) => `${INDENT}${line}`);
}

/** Capitalize a binding for its React setter: `open` -> `Open` (so the setter is `setOpen`). */
function capitalize(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** A handler as Vue's `function name(params) { ...body }` — a hoisted declaration in `<script setup>`. */
function vueHandler(step: HandlerStep): string[] {
  return [`function ${step.name}(${step.params}) {`, ...indentBody(step.body), `}`];
}

/** Render one `SetupStep` into the Vue composition API (`ref`/`computed`/`function`/`const`). */
export function vueSetupStep(step: SetupStep): string[] {
  if (step.kind === "state") {
    return [`const ${step.name} = ref(${step.init});`];
  }
  if (step.kind === "computed") {
    return [`const ${step.name} = computed(() => ${step.expr});`];
  }
  if (step.kind === "handler") {
    return vueHandler(step);
  }
  return [`const ${step.name} = ${step.expr};`];
}

/** A handler as React's `const name = (params) => { ...body }` — a const-bound arrow. */
function reactHandler(step: HandlerStep): string[] {
  return [`const ${step.name} = (${step.params}) => {`, ...indentBody(step.body), `};`];
}

/** Render one `SetupStep` into React hooks (`useState`/`useMemo`/an arrow/`const`). */
export function reactSetupStep(step: SetupStep): string[] {
  if (step.kind === "state") {
    return [`const [${step.name}, set${capitalize(step.name)}] = useState(${step.init});`];
  }
  if (step.kind === "computed") {
    const deps = (step.deps ?? []).join(", ");
    return [`const ${step.name} = useMemo(() => ${step.expr}, [${deps}]);`];
  }
  if (step.kind === "handler") {
    return reactHandler(step);
  }
  return [`const ${step.name} = ${step.expr};`];
}
