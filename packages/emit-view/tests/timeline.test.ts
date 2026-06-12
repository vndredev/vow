import { emitTimelineSfc, toGroups } from "../src/timeline.ts";
import { expect, test } from "vite-plus/test";

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

test("the group label pluralizes the change count (1 change, not 1 changes)", () => {
  const sfc = emitTimelineSfc([{ date: "2026-06-01", title: "a", version: "v2" }]);
  // The Collapsible label binds a length===1 conditional so a single-change group reads "1 change".
  expect(sfc).toContain("g.items.length === 1 ? ' change' : ' changes'");
});
