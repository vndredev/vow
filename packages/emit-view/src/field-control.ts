import type { Attr, FieldControl, ReadonlyField, UiNode } from "./types.ts";
import { FIELD_KINDS } from "@vow/core";
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

/** Vow's Select primitive — over a reference's target collection, else over a fixed option list. */
function anySelectControl(field: ReadonlyField, model: string): UiNode {
  if (field.type === "reference") {
    return referenceControl(field, model);
  }
  return selectControl(field, model);
}

/** The builder per control kind. `checkbox` maps to the native input: a boolean self-labels as a
 *  `<Checkbox>` in the form before `fieldControl` is reached, so this is the inert fall-through. */
const CONTROLS: Record<FieldControl, (field: ReadonlyField, model: string) => UiNode> = {
  checkbox: inputControl,
  date: dateControl,
  input: inputControl,
  select: anySelectControl,
  textarea: longtextControl,
};

/**
 * The input control for one field — driven by `FIELD_KINDS[type].control`. A `select` control covers vow's
 * Select primitive over a fixed option list AND over a reference's target collection; `date` a native date
 * input; `textarea` a longtext box; `input` a native input (text/number). `model` is the v-model expression
 * (e.g. `draft.title`); a reference reads its target's `<field>Choices` (a computed the caller defines).
 */
export function fieldControl(field: ReadonlyField, model: string): UiNode {
  return CONTROLS[FIELD_KINDS[field.type].control](field, model);
}
