import { DEFAULT_ROSTER, agentFor } from "../src/roster.ts";
import { expect, test } from "vite-plus/test";

const AREAS = 5;

test("the default roster has one specialized agent per vow area", () => {
  expect(DEFAULT_ROSTER).toHaveLength(AREAS);
  expect(DEFAULT_ROSTER.map((each) => each.area)).toEqual([
    "emit",
    "gate",
    "studio",
    "docs",
    "core",
  ]);
});

test("agentFor resolves the area specialist, else the general agent", () => {
  expect(agentFor(DEFAULT_ROSTER, "gate").focus).toContain("gate");
  expect(agentFor(DEFAULT_ROSTER, "nope").area).toBe("general");
});
