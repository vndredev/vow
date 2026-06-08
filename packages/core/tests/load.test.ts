import { expect, test } from "vite-plus/test";
import { validateReferences, type Field, type Vow } from "../src/index.ts";

const entity = (slug: string, fields: Field[]): Vow => ({
  id: `vow_${slug}`,
  slug,
  intent: "An entity",
  children: [],
  fulfills: { kind: "emit", as: "entity" },
  fields,
  proof: [],
});

test("validateReferences throws on a reference to a non-existent entity", () => {
  const issue = entity("issue", [
    { name: "assignee", type: "reference", required: false, ref: "ghost" },
  ]);
  expect(() => validateReferences([issue])).toThrow(/ghost/);
});

test("validateReferences passes when the reference target exists in the vows", () => {
  const user = entity("user", [{ name: "name", type: "text", required: true }]);
  const issue = entity("issue", [
    { name: "assignee", type: "reference", required: false, ref: "user" },
  ]);
  expect(() => validateReferences([user, issue])).not.toThrow();
});
