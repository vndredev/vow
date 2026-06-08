import { expect, test } from "vite-plus/test";
import { gitTimeline, parseGitLog, variantForType } from "../src/index.ts";

test("parseGitLog lifts the type + PR off the subject, leaving the description as the title", () => {
  const out = [
    "2026-06-08\tfeat: icons + badge in views (#44)",
    "2026-06-08\tdocs: the studio vision (#45)",
    "2026-06-05\tthe vow primitive", // no conventional-commit prefix, no PR
  ].join("\n");
  const entries = parseGitLog(out);
  expect(entries).toHaveLength(3);
  expect(entries[0]).toEqual({
    date: "2026-06-08",
    title: "icons + badge in views",
    type: "feat",
    pr: 44,
  });
  expect(entries[1]).toEqual({
    date: "2026-06-08",
    title: "the studio vision",
    type: "docs",
    pr: 45,
  });
  expect(entries[2]).toEqual({ date: "2026-06-05", title: "the vow primitive" }); // no type, no PR
});

test("parseGitLog ignores blank lines", () => {
  expect(parseGitLog("2026-06-08\ta\n\n")).toHaveLength(1);
});

test("variantForType maps each commit type to its Badge variant, neutral for the unknown", () => {
  expect(variantForType("feat")).toBe("success");
  expect(variantForType("fix")).toBe("warning");
  expect(variantForType("revert")).toBe("danger");
  expect(variantForType("chore")).toBe("neutral");
  expect(variantForType("nope")).toBe("neutral");
  expect(variantForType(undefined)).toBe("neutral");
});

test("gitTimeline reads the repo's first-parent history (newest first), never throwing", () => {
  const entries = gitTimeline(process.cwd());
  expect(Array.isArray(entries)).toBe(true);
  if (entries.length > 0) {
    expect(entries[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof entries[0]?.title).toBe("string");
  }
});
