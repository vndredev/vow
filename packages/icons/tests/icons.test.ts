import { expect, test } from "vite-plus/test";
import { lucide, sets } from "../src/index.ts";
import type { IconName } from "../src/types.ts";

const NAMES: IconName[] = [
  "menu",
  "search",
  "sun",
  "moon",
  "monitor",
  "chevron-down",
  "chevron-right",
  "check",
  "close",
];

test("every icon set provides an SVG for every semantic icon", () => {
  for (const [setName, set] of Object.entries(sets)) {
    for (const icon of NAMES) {
      expect(set[icon], `${setName} is missing "${icon}"`).toBeTruthy();
    }
  }
});

test("lucide entries are SVG inner markup", () => {
  for (const svg of Object.values(lucide)) {
    expect(svg).toMatch(/<(path|circle|line|rect)/u);
  }
});
