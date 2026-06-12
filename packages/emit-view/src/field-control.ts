import type { Attr, UiNode } from "@vow/component";
import type { ReadonlyField } from "@vow/core";
import { quote } from "./helpers.ts";

/** Vow's Select primitive over a fixed option list. */
function selectControl(field: ReadonlyField, model: string): UiNode {
  const opts = (field.options ?? [])
    .map((option) => `{ value: ${quote(option)}, label: ${quote(option)} }`)
    .join(", ");
  return {
    attrs: [
      { expr: model, kind: "model" },
      { expr: `[${opts}]`, kind: "bound", name: "options" },
      { kind: "static", name: "label", value: field.name },
    ],
    children: [],
    kind: "component",
    name: "Select",
  };
}

/** Vow's Select primitive over the target entity's shared collection (only existing items selectable). */
function referenceControl(field: ReadonlyField, model: string): UiNode {
  return {
    attrs: [
      { expr: model, kind: "model" },
      { expr: `${field.name}Choices`, kind: "bound", name: "options" },
      { kind: "static", name: "label", value: field.name },
    ],
    children: [],
    kind: "component",
    name: "Select",
  };
}

/** A native date input. */
function dateControl(field: ReadonlyField, model: string): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-input" },
      { kind: "static", name: "type", value: "date" },
      { expr: model, kind: "model" },
      { kind: "static", name: "aria-label", value: field.name },
    ],
    children: [],
    kind: "element",
    tag: "input",
  };
}

/** A textarea for longtext. */
function longtextControl(field: ReadonlyField, model: string): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-input vow-textarea" },
      { expr: model, kind: "model" },
      { kind: "static", name: "placeholder", value: field.name },
      { kind: "static", name: "aria-label", value: field.name },
    ],
    children: [],
    kind: "element",
    tag: "textarea",
  };
}

/** A native input for text/number — number gets the `.number` v-model modifier. */
function inputControl(field: ReadonlyField, model: string): UiNode {
  let modelAttr: Attr = { expr: model, kind: "model" };
  if (field.type === "number") {
    modelAttr = { expr: model, kind: "model", modifiers: ["number"] };
  }
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-input" },
      modelAttr,
      { kind: "static", name: "placeholder", value: field.name },
      { kind: "static", name: "aria-label", value: field.name },
    ],
    children: [],
    kind: "element",
    tag: "input",
  };
}

/**
 * The input control for one field — the shared field→control map used by the standalone `## form`.
 * select + reference render vow's Select primitive; date a native date input; longtext a textarea;
 * text/number a native input. `model` is the v-model expression (e.g. `draft.title`); a reference reads
 * its target's `<field>Choices` (a computed the caller defines in setup).
 */
export function fieldControl(field: ReadonlyField, model: string): UiNode {
  if (field.type === "select") {
    return selectControl(field, model);
  }
  if (field.type === "reference") {
    return referenceControl(field, model);
  }
  if (field.type === "date") {
    return dateControl(field, model);
  }
  if (field.type === "longtext") {
    return longtextControl(field, model);
  }
  return inputControl(field, model);
}
