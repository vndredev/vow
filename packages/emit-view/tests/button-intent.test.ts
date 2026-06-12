import { contextAttrs, intentAttrs } from "../src/button-intent.ts";
import { expect, test } from "vite-plus/test";

test("intentAttrs resolves a button intent to its design-language tokens", () => {
  // The `primary` intent → solid · accent · md (the design language owns the mapping).
  expect(intentAttrs("primary")).toEqual([
    { kind: "static", name: "variant", value: "solid" },
    { kind: "static", name: "tone", value: "accent" },
    { kind: "static", name: "size", value: "md" },
  ]);
});

test("contextAttrs resolves a context to its default intent's tokens", () => {
  // A form footer leads with `primary`; a row's actions cell defaults to `row` (ghost · sm · neutral).
  expect(contextAttrs("form-footer")).toEqual(intentAttrs("primary"));
  expect(contextAttrs("row")).toEqual([
    { kind: "static", name: "variant", value: "ghost" },
    { kind: "static", name: "tone", value: "neutral" },
    { kind: "static", name: "size", value: "sm" },
  ]);
});
