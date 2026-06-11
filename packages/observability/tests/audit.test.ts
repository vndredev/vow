import { auditIssue, auditPrompt, parseFindings } from "../src/audit.ts";
import { expect, test } from "vite-plus/test";

test("auditIssue maps a finding to a labelled, milestoned issue with the template body", () => {
  const issue = auditIssue({
    area: "area: emit",
    evidence: "the why",
    fix: "the element to build",
    title: "A bug",
  });
  expect(issue.title).toBe("A bug");
  expect(issue.labels).toEqual(["area: emit"]);
  expect(issue.milestone).toBe("Phase G — hardening (audit fixes)");
  expect(issue.body).toContain("the element to build");
  expect(issue.body).toContain("the why");
});

test("auditIssue omits labels when the finding has no area", () => {
  expect(auditIssue({ area: "", evidence: "e", fix: "f", title: "t" }).labels).toBeUndefined();
});

test("parseFindings reads the confirmed array, skipping items lacking a title or fix", () => {
  const json =
    '[{"title":"A","fix":"do A","evidence":"because","area":"area: dx"},{"title":"no fix"},{"fix":"orphan"}]';
  const findings = parseFindings(json);
  expect(findings.map((finding) => finding.title)).toEqual(["A"]);
  expect(findings[0]?.area).toBe("area: dx");
});

test("parseFindings returns [] on malformed JSON or a non-array", () => {
  expect(parseFindings("not json")).toEqual([]);
  expect(parseFindings('{"title":"x"}')).toEqual([]);
});

test("auditPrompt asks for the Finding shape — a matching sample round-trips through parseFindings", () => {
  const prompt = auditPrompt("security");
  expect(prompt).toContain("security");
  expect(prompt).toContain("title");
  expect(prompt).toContain("evidence");
  expect(
    parseFindings('[{"title":"X","area":"core","evidence":"a.ts:1","fix":"do Y"}]'),
  ).toHaveLength(1);
});
