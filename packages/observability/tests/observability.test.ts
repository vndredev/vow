import { expect, test } from "vite-plus/test";
import { gitTimeline, parseGitLog } from "../src/index.ts";

test("parseGitLog turns git-log lines into dated entries, pulling the PR number", () => {
  const out = [
    "2026-06-08\tfeat: icons + badge in views (#44)",
    "2026-06-08\tdocs: the studio vision (#45)",
    "2026-06-05\tfeat(core): the vow primitive",
  ].join("\n");
  const entries = parseGitLog(out);
  expect(entries).toHaveLength(3);
  expect(entries[0]).toEqual({
    date: "2026-06-08",
    title: "feat: icons + badge in views (#44)",
    pr: 44,
  });
  expect(entries[2]).toEqual({ date: "2026-06-05", title: "feat(core): the vow primitive" }); // no PR
});

test("parseGitLog ignores blank lines", () => {
  expect(parseGitLog("2026-06-08\ta\n\n")).toHaveLength(1);
});

test("gitTimeline reads the repo's first-parent history (newest first), never throwing", () => {
  const entries = gitTimeline(process.cwd());
  expect(Array.isArray(entries)).toBe(true);
  if (entries.length > 0) {
    expect(entries[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof entries[0]?.title).toBe("string");
  }
});
