/**
 * Pinning test: the agent's TYPE_PREFIX + PR_TITLE_MAX are hand-copied from two single sources
 * (commit-types.json keys + commitlint.config.js HEADER_MAX=72). This test makes any drift a
 * red failure rather than a silent mis-prefix or wrong truncation.
 */

import { PR_TITLE_MAX, TYPE_PREFIX } from "@vow/agent";
import { COMMIT_TYPES } from "@vow/observability";
import { expect, test } from "vite-plus/test";

// HEADER_MAX from commitlint.config.js — the two must move in lockstep.
const HEADER_MAX = 72;

test("PR_TITLE_MAX equals HEADER_MAX from commitlint.config.js", () => {
  expect(PR_TITLE_MAX).toBe(HEADER_MAX);
});

test("TYPE_PREFIX accepts exactly the keys of commit-types.json, no more and no less", () => {
  // Extract the (?:a|b|c) alternation from the regex source and compare to the JSON keys.
  const typeAlts = /\(\?:([^)]+)\)/u.exec(TYPE_PREFIX.source)?.[1]?.split("|") ?? [];
  expect(typeAlts.toSorted()).toEqual(Object.keys(COMMIT_TYPES).toSorted());
});

test("TYPE_PREFIX matches every key from commit-types.json when used as a subject prefix", () => {
  for (const type of Object.keys(COMMIT_TYPES)) {
    expect(TYPE_PREFIX.test(`${type}: some title`)).toBe(true);
  }
});

test("TYPE_PREFIX does not match a type not in commit-types.json", () => {
  expect(TYPE_PREFIX.test("unknown: title")).toBe(false);
  expect(TYPE_PREFIX.test("newtype: title")).toBe(false);
  expect(TYPE_PREFIX.test("wip: title")).toBe(false);
});
