import { expect, test } from "vite-plus/test";
import { gitTimeline, parseGitLog, variantForType } from "../src/index.ts";
import { NONE } from "../src/none.ts";

const THIRD = 2;
const THREE = 3;
const PR_44 = 44;
const PR_45 = 45;

test("parseGitLog lifts the type + PR off the subject and inherits the release tag as version", () => {
  const out = [
    // Tagged -> version.
    "2026-06-08\ttag: v0.1.0\tfeat: icons + badge in views (#44)",
    // Untagged -> inherits the version above.
    "2026-06-08\t\tdocs: the studio vision (#45)",
    // No cc prefix, no PR; still v0.1.0.
    "2026-06-05\t\tthe vow primitive",
  ].join("\n");
  const entries = parseGitLog(out);
  expect(entries).toHaveLength(THREE);
  expect(entries[0]).toEqual({
    date: "2026-06-08",
    pr: PR_44,
    title: "icons + badge in views",
    type: "feat",
    version: "v0.1.0",
  });
  expect(entries[1]).toEqual({
    date: "2026-06-08",
    pr: PR_45,
    title: "the studio vision",
    type: "docs",
    version: "v0.1.0",
  });
  expect(entries[THIRD]).toEqual({
    date: "2026-06-05",
    title: "the vow primitive",
    version: "v0.1.0",
  });
});

test("parseGitLog: commits above the newest tag have no version (Unreleased)", () => {
  const out = ["2026-06-09\t\tfeat: unreleased", "2026-06-08\ttag: v0.1.0\tfeat: shipped"].join(
    "\n",
  );
  const entries = parseGitLog(out);
  // No version.
  expect(entries[0]).toEqual({ date: "2026-06-09", title: "unreleased", type: "feat" });
  expect(entries[1]?.version).toBe("v0.1.0");
});

test("parseGitLog ignores blank lines", () => {
  expect(parseGitLog("2026-06-08\t\ta\n\n")).toHaveLength(1);
});

test("parseGitLog reads a breaking `feat!:` and a slashed scope `(ci/cd)`", () => {
  const out = ["2026-06-09\t\tfeat!: drop the old api", "2026-06-09\t\tfix(ci/cd): the gate"].join(
    "\n",
  );
  const entries = parseGitLog(out);
  expect(entries[0]).toMatchObject({ title: "drop the old api", type: "feat" });
  expect(entries[1]).toMatchObject({ title: "the gate", type: "fix" });
});

test("variantForType maps each commit type to its Badge variant, neutral for the unknown", () => {
  expect(variantForType("feat")).toBe("success");
  expect(variantForType("fix")).toBe("warning");
  expect(variantForType("revert")).toBe("danger");
  expect(variantForType("chore")).toBe("neutral");
  expect(variantForType("nope")).toBe("neutral");
  expect(variantForType(NONE)).toBe("neutral");
});

test("gitTimeline reads the repo's first-parent history (newest first), never throwing", () => {
  const entries = gitTimeline(process.cwd());
  expect(Array.isArray(entries)).toBe(true);
  if (entries.length > 0) {
    expect(entries[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(typeof entries[0]?.title).toBe("string");
  }
});
