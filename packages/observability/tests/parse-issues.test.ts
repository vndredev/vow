import { expect, test } from "vite-plus/test";
import { parseIssues } from "../src/github.ts";

test("parseIssues drops non-object elements instead of coercing them to a record", () => {
  const issues = parseIssues('[{"number":1,"title":"a","state":"open"}, 5, null, "x", true]');
  expect(issues.map((issue) => issue.number)).toEqual([1]);
});

test("parseIssues returns [] on malformed JSON or a non-array", () => {
  expect(parseIssues("not json")).toEqual([]);
  expect(parseIssues('{"number":1}')).toEqual([]);
});
