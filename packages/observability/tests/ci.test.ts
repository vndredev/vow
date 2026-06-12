import { ciStateForHead, ciStateFrom, mergedFrom } from "../src/ci.ts";
import { expect, test } from "vite-plus/test";

test("ciStateFrom folds a check rollup into one verdict (fail beats pending beats pass)", () => {
  const pass = '{"statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"}]}';
  const fail =
    '{"statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"},{"status":"COMPLETED","conclusion":"FAILURE"}]}';
  const pending =
    '{"statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"},{"status":"IN_PROGRESS","conclusion":""}]}';
  expect(ciStateFrom(pass)).toBe("pass");
  expect(ciStateFrom(fail)).toBe("fail");
  expect(ciStateFrom(pending)).toBe("pending");
});

test("ciStateFrom treats an empty / absent / malformed rollup as pending", () => {
  expect(ciStateFrom('{"statusCheckRollup":[]}')).toBe("pending");
  expect(ciStateFrom("{}")).toBe("pending");
  expect(ciStateFrom("not json")).toBe("pending");
});

test("ciStateFrom reads legacy StatusContext nodes by their `state` (no `status` field)", () => {
  const pass = '{"statusCheckRollup":[{"__typename":"StatusContext","state":"SUCCESS"}]}';
  const fail = '{"statusCheckRollup":[{"__typename":"StatusContext","state":"FAILURE"}]}';
  const error = '{"statusCheckRollup":[{"__typename":"StatusContext","state":"ERROR"}]}';
  const pending = '{"statusCheckRollup":[{"__typename":"StatusContext","state":"PENDING"}]}';
  expect(ciStateFrom(pass)).toBe("pass");
  expect(ciStateFrom(fail)).toBe("fail");
  expect(ciStateFrom(error)).toBe("fail");
  expect(ciStateFrom(pending)).toBe("pending");
});

test("ciStateFrom: a red StatusContext beats a passing CheckRun (never waits on red)", () => {
  const mixed =
    '{"statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"},{"__typename":"StatusContext","state":"FAILURE"}]}';
  expect(ciStateFrom(mixed)).toBe("fail");
});

test("ciStateForHead: a green rollup only passes when its head matches the expected SHA", () => {
  const greenForNew =
    '{"headRefOid":"new123","statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"}]}';
  // The expected (post-rebase) head matches -> read the real verdict.
  expect(ciStateForHead(greenForNew, "new123")).toBe("pass");
  // A stale read of the PREVIOUS head's green run -> pending, so the loop waits, never merges stale-green.
  expect(ciStateForHead(greenForNew, "rebased999")).toBe("pending");
  // An absent head, or no expected SHA to pin against, is pending too (never a merge on an unpinned read).
  expect(ciStateForHead('{"statusCheckRollup":[]}', "new123")).toBe("pending");
  expect(ciStateForHead(greenForNew, "")).toBe("pending");
});

test("ciStateForHead: a matching head still reports fail / pending honestly", () => {
  const failForNew =
    '{"headRefOid":"new123","statusCheckRollup":[{"status":"COMPLETED","conclusion":"FAILURE"}]}';
  const runningForNew =
    '{"headRefOid":"new123","statusCheckRollup":[{"status":"IN_PROGRESS","conclusion":""}]}';
  expect(ciStateForHead(failForNew, "new123")).toBe("fail");
  expect(ciStateForHead(runningForNew, "new123")).toBe("pending");
});

test("mergedFrom reads a PR's MERGED state — the post-merge guard tells a real failure from a cleanup hiccup", () => {
  // A MERGED pr is a success even if `gh pr merge` exited non-zero on a post-merge cleanup step.
  expect(mergedFrom('{"state":"MERGED"}')).toBe(true);
  // An OPEN / CLOSED pr (the merge genuinely didn't land) is not a success.
  expect(mergedFrom('{"state":"OPEN"}')).toBe(false);
  expect(mergedFrom('{"state":"CLOSED"}')).toBe(false);
  // A malformed / empty payload is never read as merged (fail closed).
  expect(mergedFrom("not json")).toBe(false);
  expect(mergedFrom("{}")).toBe(false);
});
