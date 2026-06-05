import { expect, test } from "vite-plus/test";
import { computeTotal } from "./invoice-total.ts";

// Hand-written proof for the bound logic — the test names ARE the vow's `## proves`.
test("ab 10 Stück greift der Rabatt", () => {
  expect(computeTotal({ qty: 10, unit: 100 })).toBe(950);
});

test("unter 10 Stück gibt es keinen Rabatt", () => {
  expect(computeTotal({ qty: 9, unit: 100 })).toBe(900);
});
