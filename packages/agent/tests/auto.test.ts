import { expect, test } from "vite-plus/test";
import { autoDecision } from "../src/auto.ts";

const MAX = 8;
const SOME = 5;
const MID = 3;

test("autoDecision: empty backlog shuts down, the round cap stops, otherwise it develops", () => {
  expect(autoDecision({ maxRounds: MAX, openIssues: 0, round: MID })).toBe("done");
  expect(autoDecision({ maxRounds: MAX, openIssues: SOME, round: MAX })).toBe("exhausted");
  expect(autoDecision({ maxRounds: MAX, openIssues: SOME, round: 0 })).toBe("develop");
  expect(autoDecision({ maxRounds: MAX, openIssues: SOME, round: MAX - 1 })).toBe("develop");
});
