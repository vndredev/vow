import { NORTH_STAR, PILLAR_PREFIX } from "../src/pillar.ts";
import { expect, test } from "vite-plus/test";

test("every NORTH_STAR label is in the pillar namespace; NORTH_STAR lists the four pillars", () => {
  const FOUR = 4;
  expect(NORTH_STAR.length).toBe(FOUR);
  for (const pillar of NORTH_STAR) {
    expect(pillar.label.startsWith(PILLAR_PREFIX)).toBe(true);
  }
});

test("each pillar carries a title, a horizon, and at least one router signal", () => {
  for (const pillar of NORTH_STAR) {
    expect(pillar.title).not.toBe("");
    expect(pillar.horizon).not.toBe("");
    expect(pillar.signals.length).toBeGreaterThan(0);
  }
});
