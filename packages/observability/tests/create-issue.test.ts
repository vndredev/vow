import { expect, test } from "vite-plus/test";
import { createIssueOptions } from "../src/github.ts";

test("createIssueOptions builds gh flags for present optionals, omitting absent ones", () => {
  expect(
    createIssueOptions({
      assignee: "me",
      body: "b",
      labels: ["a", "x"],
      milestone: "M1",
      title: "t",
    }),
  ).toEqual(["--label", "a,x", "--assignee", "me", "--milestone", "M1"]);
  expect(createIssueOptions({ body: "b", title: "t" })).toEqual([]);
  expect(createIssueOptions({ body: "b", labels: [], title: "t" })).toEqual([]);
});
