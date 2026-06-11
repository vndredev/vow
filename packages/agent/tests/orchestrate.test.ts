import { expect, test } from "vite-plus/test";
import { mapLimit } from "../src/index.ts";

const LIMIT = 2;

test("mapLimit runs a worker over items, preserving input order", async () => {
  const out = await mapLimit(["a", "b", "c"], LIMIT, async (str) => {
    await Promise.resolve();
    return str.toUpperCase();
  });
  expect(out).toEqual(["A", "B", "C"]);
});

test("mapLimit never runs more than `limit` workers at once", async () => {
  const items = ["a", "b", "c", "d", "e"];
  let inFlight = 0;
  let peak = 0;
  await mapLimit(items, LIMIT, async (str) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await Promise.resolve();
    inFlight -= 1;
    return str;
  });
  expect(peak).toBeLessThanOrEqual(LIMIT);
});
