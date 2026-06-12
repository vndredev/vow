import { expect, test } from "vite-plus/test";
import { humanizeFieldName, pascalCase } from "../src/naming.ts";

/*
 * The naming helpers turn machine identifiers into the names a generated app shows. `pascalCase` makes a
 * kebab slug a type/component name; `humanizeFieldName` (#436) turns a camelCase field name into the
 * sentence-case copy used at every label, placeholder, header, card row and validation message — so the
 * end user reads "Sync interval", never the dev identifier "syncInterval".
 */

test("pascalCase turns a kebab slug into a PascalCase name", () => {
  expect(pascalCase("task")).toBe("Task");
  expect(pascalCase("audit-log")).toBe("AuditLog");
});

test("humanizeFieldName turns camelCase into a sentence-case label", () => {
  expect(humanizeFieldName("syncInterval")).toBe("Sync interval");
  expect(humanizeFieldName("planStatus")).toBe("Plan status");
});

test("humanizeFieldName capitalizes a single word", () => {
  expect(humanizeFieldName("title")).toBe("Title");
  expect(humanizeFieldName("status")).toBe("Status");
});

test("humanizeFieldName separates a digit run from its word", () => {
  expect(humanizeFieldName("address2")).toBe("Address 2");
  expect(humanizeFieldName("oauth2Token")).toBe("Oauth 2 token");
});
