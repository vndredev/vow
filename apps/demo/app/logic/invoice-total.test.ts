import { expect, test } from "vite-plus/test";
import { computeTotal } from "./invoice-total.ts";

// Hand-written proof for the bound logic — the test names ARE the vow's `## proves`.
test("a discount applies from 10 units", () => {
  expect(computeTotal({ qty: 10, unit: 100 })).toBe(950);
});

test("under 10 units there is no discount", () => {
  expect(computeTotal({ qty: 9, unit: 100 })).toBe(900);
});
