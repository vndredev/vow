import { expect, test } from "vite-plus/test";
import { summarise } from "./task-summary.ts";

// Hand-written proof for the bound logic — the test names ARE the vow's `## proves`.
test("it counts the done tasks against the total", () => {
  expect(summarise([{ done: true }, { done: false }, { done: true }])).toBe("2 of 3 done");
});

test("an empty list reads zero of zero", () => {
  expect(summarise([])).toBe("0 of 0 done");
});
