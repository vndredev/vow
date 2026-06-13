import { auditIssue, parseFindings } from "../src/audit.ts";
import { expect, test } from "vite-plus/test";
import { NONE } from "../src/none.ts";

test("auditIssue stamps the resolved phase, with the area label + the template body", () => {
  const issue = auditIssue(
    { area: "emit", evidence: "the why", fix: "the element to build", title: "A bug" },
    "Phase I — the UI framework",
  );
  expect(issue.title).toBe("A bug");
  expect(issue.labels).toEqual(["area: emit"]);
  expect(issue.milestone).toBe("Phase I — the UI framework");
  expect(issue.body).toContain("the element to build");
  expect(issue.body).toContain("the why");
});

test("auditIssue omits labels when the finding has no area", () => {
  expect(
    auditIssue({ area: "", evidence: "e", fix: "f", title: "t" }, "Phase X").labels,
  ).toBeUndefined();
});

test("auditIssue omits the area label for an area with no repo label, but still files the phase", () => {
  const issue = auditIssue({ area: "cli", evidence: "e", fix: "f", title: "t" }, "Phase X");
  expect(issue.labels).toBeUndefined();
  expect(issue.title).toBe("t");
  expect(issue.milestone).toBe("Phase X");
});

test("auditIssue files bare (no milestone) when no phase resolves — a milestone-less repo", () => {
  expect(
    auditIssue({ area: "emit", evidence: "e", fix: "f", title: "t" }, NONE).milestone,
  ).toBeUndefined();
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
