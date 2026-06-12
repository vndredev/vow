import type { ReadonlyField, ReadonlyVow, UiNode } from "./types.ts";
import { comp } from "./helpers.ts";
import { defined } from "@vow/core";
import { humanizeFieldName } from "@vow/component";

/** One labelled body row in a card — `<p><strong>name: </strong>{{ value }}</p>`. */
function bodyField(field: ReadonlyField): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-card__field" }],
    children: [
      {
        attrs: [],
        children: [{ kind: "text", text: `${humanizeFieldName(field.name)}: ` }],
        kind: "element",
        tag: "strong",
      },
      { expr: `item.${field.name}`, kind: "interp" },
    ],
    kind: "element",
    tag: "p",
  };
}

/** The field that titles a record — the first `text`/`longtext` field, else the first field of any kind. */
export function titleField(entity: ReadonlyVow): ReadonlyField | undefined {
  return (
    entity.fields.find((field) => field.type === "text" || field.type === "longtext") ??
    entity.fields[0]
  );
}

/** The Card header + body for one record in a generated card/board view (title field → header, rest → body). */
export function recordCard(entity: ReadonlyVow, omit: readonly string[]): UiNode[] {
  const title = titleField(entity);
  const bodyFields = entity.fields.filter(
    (field) => field.name !== title?.name && !omit.includes(field.name),
  );
  const children: UiNode[] = [];
  if (defined(title)) {
    children.push(comp("CardHeader", [], [{ expr: `item.${title.name}`, kind: "interp" }]));
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
