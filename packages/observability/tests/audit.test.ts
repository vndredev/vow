import { auditIssue, parseFindings } from "../src/audit.ts";
import { expect, test } from "vite-plus/test";

test("auditIssue files a BUG — the bug-template body + the bug + area labels", () => {
  const issue = auditIssue({
    area: "emit",
    evidence: "the why",
    fix: "the element to build",
    title: "A bug",
  });
  expect(issue.title).toBe("A bug");
  // A bug, not a feature — so the `bug` label leads + the area label when the repo carries it.
  expect(issue.labels).toEqual(["bug", "area: emit"]);
  // No milestone — the throughline + phase live on the local plan, not a routed GitHub field.
  expect(issue.milestone).toBeUndefined();
  // The BUG template (not the feature one), so the issue-template gate passes + it reads as a bug.
  expect(issue.body).toContain("What happened");
  expect(issue.body).toContain("the why");
  expect(issue.body).toContain("the element to build");
});

test("auditIssue always carries the bug label, with no area label for an empty / unknown area", () => {
  expect(auditIssue({ area: "", evidence: "e", fix: "f", title: "t" }).labels).toEqual(["bug"]);
  // "cli" is a real area but carries no repo `area:` label — so just `bug`, never a label gh rejects.
  expect(auditIssue({ area: "cli", evidence: "e", fix: "f", title: "t" }).labels).toEqual(["bug"]);
});

test("parseFindings reads the confirmed array, skipping items lacking a title or fix", () => {
  const json =
    '[{"title":"A","fix":"do A","evidence":"because","area":"dx"},{"title":"no fix"},{"fix":"orphan"}]';
  const findings = parseFindings(json);
  expect(findings.map((finding) => finding.title)).toEqual(["A"]);
  expect(findings[0]?.area).toBe("dx");
});

test("parseFindings returns [] on malformed JSON or a non-array", () => {
  expect(parseFindings("not json")).toEqual([]);
  expect(parseFindings('{"title":"x"}')).toEqual([]);
});

test("parseFindings ingests a well-formed finding sample (the shape the audit prompt asks for)", () => {
  expect(
    parseFindings('[{"title":"X","area":"core","evidence":"a.ts:1","fix":"do Y"}]'),
  ).toHaveLength(1);
});
