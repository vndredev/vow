// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { tagComplete } from "../src/dev.ts";

test("tagComplete tags whole lines and holds a trailing partial", () => {
  expect(tagComplete("a\nb\n", "[s] ")).toEqual({ out: "[s] a\n[s] b\n", rest: "" });
  expect(tagComplete("hel", "[s] ")).toEqual({ out: "", rest: "hel" });
});

test("tagComplete never double-tags a line split across chunk boundaries", () => {
  // The audit bug: "hello wo" then "rld\n" became "[s] hello wo[s] rld".
  const first = tagComplete("hello wo", "[s] ");
  expect(first).toEqual({ out: "", rest: "hello wo" });
  const second = tagComplete(`${first.rest}rld\n`, "[s] ");
  expect(second).toEqual({ out: "[s] hello world\n", rest: "" });
});

test("tagComplete leaves a blank line untagged", () => {
  expect(tagComplete("a\n\nb\n", "[s] ")).toEqual({ out: "[s] a\n\n[s] b\n", rest: "" });
});
