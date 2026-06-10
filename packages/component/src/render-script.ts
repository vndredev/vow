import type { Component, ImportDecl, PropDef } from "./model.ts";
import { defined } from "./defined.ts";

/** Render one import: a default binding, named bindings, or both. */
function renderImport(decl: ImportDecl): string {
  const parts: string[] = [];
  if (defined(decl.default)) {
    parts.push(decl.default);
  }
  if (defined(decl.names) && decl.names.length > 0) {
    parts.push(`{ ${decl.names.join(", ")} }`);
  }
  return `import ${parts.join(", ")} from "${decl.from}";`;
}

/** One prop field in the `defineProps<{ ... }>` type, e.g. `disabled?: boolean`. */
function propField(prop: PropDef): string {
  let optional = "";
  if (prop.optional === true) {
    optional = "?";
  }
  return `${prop.name}${optional}: ${prop.tsType}`;
}

/** The `const props = ...` declaration; `withDefaults` only when some prop carries a default. */
function renderProps(props: readonly PropDef[]): string {
  const fields = props.map((prop) => propField(prop)).join("; ");
  const withDefaults = props.filter((prop) => defined(prop.default));
  // WithDefaults only when some prop carries a default; otherwise the exact legacy line (byte-stable).
  if (withDefaults.length > 0) {
    const defaults = withDefaults.map((prop) => `${prop.name}: ${prop.default}`).join(", ");
    return `const props = withDefaults(defineProps<{ ${fields} }>(), { ${defaults} });`;
  }
  return `const props = defineProps<{ ${fields} }>();`;
}

/** The `const emit = ...` declaration from the component's events. */
function renderEmits(component: Component): string {
  const events = component.events ?? [];
  const fields = events
    .map((event) => `${JSON.stringify(event.name)}: [${event.payload}]`)
    .join("; ");
  return `const emit = defineEmits<{ ${fields} }>();`;
}

/** Join non-empty sections with a single blank line between them. */
function joinSections(sections: readonly (readonly string[])[]): string[] {
  const present = sections.filter((section) => section.length > 0);
  const out: string[] = [];
  for (const section of present) {
    if (out.length > 0) {
      out.push("");
    }
    out.push(...section);
  }
  return out;
}

/**
 * The `<script setup>` body lines — head (doc+imports), declarations (props+emits), setup; a blank
 * line between non-empty sections.
 */
export function renderScript(component: Component): string[] {
  const head: string[] = [
    ...(component.doc ?? []).map((line) => `// ${line}`),
    ...(component.imports ?? []).map((decl) => renderImport(decl)),
  ];
  const decls: string[] = [];
  if (defined(component.props) && component.props.length > 0) {
    decls.push(renderProps(component.props));
  }
  if (defined(component.events) && component.events.length > 0) {
    decls.push(renderEmits(component));
  }
  return joinSections([head, decls, [...(component.setup ?? [])]]);
}
