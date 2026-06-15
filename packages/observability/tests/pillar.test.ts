import {
  NORTH_STAR,
  PILLAR_LABELS,
  PILLAR_PREFIX,
  ensurePillar,
  resolvePillar,
} from "../src/pillar.ts";
import { expect, test } from "vite-plus/test";

test("resolvePillar routes each pillar by one of its signals", () => {
  expect(resolvePillar("emit a themed primitive")).toBe("pillar:describe-to-app");
  expect(resolvePillar("the agent loop merges a PR")).toBe("pillar:self-building");
  expect(resolvePillar("the roadmap cockpit + audit")).toBe("pillar:self-planning");
  expect(resolvePillar("a lint gate + hook against drift")).toBe("pillar:mechanical-integrity");
});

test("resolvePillar precedence — the NORTH_STAR order wins when signals overlap", () => {
  // "design" (describe-to-app, first) beats "gate" (mechanical-integrity, last).
  expect(resolvePillar("a design-language gate")).toBe("pillar:describe-to-app");
});

test("resolvePillar is case-insensitive", () => {
  expect(resolvePillar("EMIT a primitive")).toBe("pillar:describe-to-app");
});

test("resolvePillar is NONE when nothing matches — the gate then flags it", () => {
  expect(resolvePillar("a generic settings store for model policy")).toBeUndefined();
});

test("ensurePillar appends the routed pillar when none is present", () => {
  expect(ensurePillar(["enhancement"], "the agent team")).toEqual([
    "enhancement",
    "pillar:self-building",
  ]);
});

test("ensurePillar respects an explicit pillar label — no override", () => {
  expect(ensurePillar(["pillar:mechanical-integrity"], "the agent team")).toEqual([
    "pillar:mechanical-integrity",
  ]);
});

test("ensurePillar leaves labels unchanged when nothing routes", () => {
  expect(ensurePillar(["enhancement"], "a generic settings store")).toEqual(["enhancement"]);
});

test("every NORTH_STAR label is in the pillar namespace; PILLAR_LABELS lists all four", () => {
  expect(PILLAR_LABELS.length).toBe(NORTH_STAR.length);
  for (const label of PILLAR_LABELS) {
    expect(label.startsWith(PILLAR_PREFIX)).toBe(true);
  }
});
