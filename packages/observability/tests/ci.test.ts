import { expect, test } from "vite-plus/test";
import { ciStateFrom } from "../src/ci.ts";

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
