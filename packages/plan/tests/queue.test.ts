import type { PlanDep, PlanItem } from "../src/types.ts";
import { blockedItems, readyQueue, unblocksMost } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const HIGH = 5;
const FREED = 2;

/** A plan item fixture — `ready`, priority 0, position 0 — overridable per test. */
function item(over: Partial<PlanItem>): PlanItem {
  return {
    createdAt: "",
    id: "x",
    origin: "internal",
    position: 0,
    priority: 0,
    status: "ready",
    title: "t",
    updatedAt: "",
    ...over,
  };
}

test("readyQueue: ready + unblocked items, ordered by priority (desc) then position (asc)", () => {
  const items = [
    item({ id: "a", position: 1, priority: 1 }),
    item({ id: "b", position: 0, priority: HIGH }),
    item({ id: "c", position: 0, priority: 1 }),
  ];
  expect(readyQueue(items, []).map((each) => each.id)).toEqual(["b", "c", "a"]);
});

test("readyQueue: only `ready` items qualify — backlog/doing/done are not next-work", () => {
  const items = [
    item({ id: "a", status: "backlog" }),
    item({ id: "b", status: "doing" }),
    item({ id: "c", status: "ready" }),
  ];
  expect(readyQueue(items, []).map((each) => each.id)).toEqual(["c"]);
});

test("readyQueue: a dep that isn't done holds an item back; a done dep unblocks it", () => {
  const blocked = item({ id: "blocked" });
  const deps: PlanDep[] = [{ dependsOn: "blocker", item: "blocked" }];
  const openBlocker = item({ id: "blocker" });
  expect(readyQueue([openBlocker, blocked], deps).map((each) => each.id)).toEqual(["blocker"]);
  const doneBlocker = item({ id: "blocker", status: "done" });
  expect(readyQueue([doneBlocker, blocked], deps).map((each) => each.id)).toEqual(["blocked"]);
});

test("blockedItems lists the ready items still waiting, each with its blockers", () => {
  const blocked = item({ id: "blocked" });
  const deps: PlanDep[] = [{ dependsOn: "x", item: "blocked" }];
  const result = blockedItems([blocked], deps);
  expect(result.length).toBe(1);
  expect(result[0]?.item.id).toBe("blocked");
  expect(result[0]?.blockers).toEqual(["x"]);
});

test("unblocksMost ranks an item by how many it is the last blocker of", () => {
  const key = item({ id: "key" });
  const one = item({ id: "one" });
  const two = item({ id: "two" });
  const deps: PlanDep[] = [
    { dependsOn: "key", item: "one" },
    { dependsOn: "key", item: "two" },
  ];
  expect(unblocksMost([key, one, two], deps)).toEqual([{ id: "key", unblocks: FREED }]);
});
