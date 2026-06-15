import { expect, test } from "vite-plus/test";
import type { PlanSession } from "../src/types.ts";
import { staleSessions } from "../src/index.ts";

/** A session fixture bound to `item` — overridable fields default to a throwaway worktree. */
function session(item: string): PlanSession {
  return { branch: "feat/issue-1", item, startedAt: "", worktree: "/tmp/wt" };
}

test("staleSessions: the sessions whose item is not in the active set are released", () => {
  const sessions = [session("a"), session("b"), session("c")];
  expect(staleSessions(sessions, ["b"]).map((each) => each.item)).toEqual(["a", "c"]);
});

test("staleSessions: every item active — nothing is stale", () => {
  const sessions = [session("a"), session("b")];
  expect(staleSessions(sessions, ["a", "b"])).toEqual([]);
});
