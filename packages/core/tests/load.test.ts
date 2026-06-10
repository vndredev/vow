import { expect, test } from "vite-plus/test";
import { validateReferences } from "../src/index.ts";

/** The read-only vow + field shapes, derived from `validateReferences` so only the value is imported. */
type Vow = Parameters<typeof validateReferences>[0][number];
type Field = NonNullable<Vow["fields"]>[number];

const entity = (slug: string, fields: readonly Field[]): Vow => ({
  children: [],
  fields,
  fulfills: { as: "entity", kind: "emit" },
  id: `vow_${slug}`,
  intent: "An entity",
  proof: [],
  slug,
});

test("validateReferences throws on a reference to a non-existent entity", () => {
  const issue = entity("issue", [
    { name: "assignee", ref: "ghost", required: false, type: "reference" },
  ]);
  expect(() => {
    validateReferences([issue]);
  }).toThrow(/ghost/u);
});

test("validateReferences passes when the reference target exists in the vows", () => {
  const user = entity("user", [{ name: "name", required: true, type: "text" }]);
  const issue = entity("issue", [
    { name: "assignee", ref: "user", required: false, type: "reference" },
  ]);
  expect(() => {
    validateReferences([user, issue]);
  }).not.toThrow();
});
