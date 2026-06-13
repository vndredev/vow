/**
 * Pinning test for the commit-vocabulary seam (#596). The agent authors PR titles / squash subjects, so it
 * must agree with what the commit-msg lint accepts. Both now read ONE source — `COMMIT_TYPES` + `HEADER_MAX`
 * from @vow/observability — but two seams could still drift silently:
 *   (a) the agent's `TYPE_PREFIX` regex, derived from `COMMIT_TYPES`, must accept EXACTLY those types;
 *   (b) the agent's `PR_TITLE_MAX` must equal the single-sourced `HEADER_MAX`;
 *   (c) `commitlint.config.js` `header-max-length` must equal that same `HEADER_MAX`.
 * Any divergence is a red failure here rather than a silent mis-prefix or wrong truncation.
 */

import { COMMIT_TYPES, HEADER_MAX } from "@vow/observability";
import { PR_TITLE_MAX, TYPE_PREFIX } from "@vow/agent";
import { expect, test } from "vite-plus/test";
import path from "node:path";
import { readFileSync } from "node:fs";

/** The `header-max-length` literal commitlint enforces, read from the root config (plain Node, so it can't
 *  import the TS package — the value is a literal there, pinned by this test). */
function commitlintHeaderMax(): number {
  const config = path.resolve(import.meta.dirname, "..", "..", "..", "commitlint.config.js");
  const source = readFileSync(config, "utf8");
  const match = /const HEADER_MAX = (\d+);/u.exec(source);
  return Number(match?.[1] ?? "0");
}

test("the agent's TYPE_PREFIX accepts exactly the single-sourced commit vocabulary", () => {
  for (const type of Object.keys(COMMIT_TYPES)) {
    expect(TYPE_PREFIX.test(`${type}: a subject`)).toBe(true);
  }
});

test("the agent's TYPE_PREFIX rejects a token outside the commit vocabulary", () => {
  for (const unknown of ["wip", "newtype", "hotfix"]) {
    expect(Object.keys(COMMIT_TYPES).includes(unknown)).toBe(false);
    expect(TYPE_PREFIX.test(`${unknown}: a subject`)).toBe(false);
  }
});

test("the agent's PR_TITLE_MAX equals the single-sourced HEADER_MAX", () => {
  expect(PR_TITLE_MAX).toBe(HEADER_MAX);
});

test("commitlint.config.js header-max-length equals the single-sourced HEADER_MAX", () => {
  expect(commitlintHeaderMax()).toBe(HEADER_MAX);
});
