import { expect, test } from "vite-plus/test";
import { toGroups } from "../src/timeline.ts";

const V2_COUNT = 2;

test("toGroups accumulates a version's entries even when the log interleaves versions", () => {
  const groups = toGroups([
    { date: "2026-06-01", title: "a", version: "v2" },
    { date: "2026-05-01", title: "b", version: "v1" },
    { date: "2026-06-02", title: "c", version: "v2" },
  ]);
  // The v2 group keeps both its entries (not split by the interposed v1); first-seen order on top.
  const [first, second] = groups;
  expect(first?.version).toBe("v2");
  expect(first?.items).toHaveLength(V2_COUNT);
  expect(second?.version).toBe("v1");
  expect(second?.items).toHaveLength(1);
});
