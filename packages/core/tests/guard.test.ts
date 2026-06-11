import { NONE, defined, mapDefined } from "../src/guard.ts";
import { expect, test } from "vite-plus/test";

test("NONE is the canonical absence — defined() rejects it, mapDefined passes it through", () => {
  expect(defined(NONE)).toBe(false);
  expect(mapDefined(NONE, () => "mapped")).toBeUndefined();
  expect(defined("x")).toBe(true);
});
