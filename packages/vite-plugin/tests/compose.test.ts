// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { NONE } from "../src/none.ts";
import { timelineHit } from "../src/compose.ts";

const cache = { head: "abc1234", srcDir: "/app", timeline: [] };

test("timelineHit matches only the same srcDir + HEAD — so a commit (HEAD change) re-shells git log", () => {
  expect(timelineHit(cache, "/app", "abc1234")).toBe(true);
  expect(timelineHit(cache, "/app", "def5678")).toBe(false);
  expect(timelineHit(cache, "/other", "abc1234")).toBe(false);
  expect(timelineHit(NONE, "/app", "abc1234")).toBe(false);
});
