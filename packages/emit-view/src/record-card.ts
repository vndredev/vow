import type { ReadonlyField, ReadonlyVow, UiNode } from "./types.ts";
import { comp } from "./helpers.ts";
import { defined } from "@vow/core";

/** One labelled body row in a card — `<p><strong>name: </strong>{{ value }}</p>`. */
function bodyField(field: ReadonlyField): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-card__field" }],
    children: [
      {
        attrs: [],
        children: [{ kind: "text", text: `${field.name}: ` }],
        kind: "element",
        tag: "strong",
      },
      { expr: `item.${field.name}`, kind: "interp" },
    ],
    kind: "element",
    tag: "p",
  };
}

/** The Card header + body for one record in a generated card/board view (title field → header, rest → body). */
export function recordCard(entity: ReadonlyVow, omit: readonly string[]): UiNode[] {
  const titleField =
    entity.fields.find((field) => field.type === "text" || field.type === "longtext") ??
    entity.fields[0];
  const bodyFields = entity.fields.filter(
    (field) => field.name !== titleField?.name && !omit.includes(field.name),
  );
  const children: UiNode[] = [];
  if (defined(titleField)) {
    children.push(comp("CardHeader", [], [{ expr: `item.${titleField.name}`, kind: "interp" }]));
  }
  if (bodyFields.length > 0) {
    children.push(
      comp(
        "CardBody",
        [],
        bodyFields.map((field) => bodyField(field)),
      ),
    );
  }
  return children;
}
