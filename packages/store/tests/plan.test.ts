// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { parsePlanSnapshot } from "../src/plan.ts";

const ISSUE = 42;

test("parsePlanSnapshot validates the wire into a typed snapshot", () => {
  const snap = parsePlanSnapshot({
    blocked: [{ blockers: ["x1"], id: "b1" }],
    items: [
      {
        createdAt: "",
        id: "i1",
        issue: ISSUE,
        origin: "internal",
        pillar: "pillar:self-planning",
        position: 0,
        priority: 0,
        status: "doing",
        title: "t",
        updatedAt: "",
      },
    ],
    ready: ["i1"],
  });
  expect(snap.items[0]?.issue).toBe(ISSUE);
  expect(snap.items[0]?.status).toBe("doing");
  expect(snap.ready).toEqual(["i1"]);
  expect(snap.blocked[0]?.id).toBe("b1");
});

test("parsePlanSnapshot degrades a malformed response to the empty plan", () => {
  const snap = parsePlanSnapshot("nope");
  expect(snap.items).toEqual([]);
  expect(snap.ready).toEqual([]);
  expect(snap.blocked).toEqual([]);
});
