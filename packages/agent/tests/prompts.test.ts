import {
  DEFAULT_AUDIT_PROMPT,
  DEFAULT_DEEP_AUDIT_PROMPT,
  PROMPT_ROLES,
  defaultPrompt,
  fillPrompt,
  promptRelPath,
  promptTemplates,
  renderAuditPrompt,
  renderDeepAuditPrompt,
} from "../src/prompts.ts";
import { expect, test } from "vite-plus/test";

test("defaultPrompt returns the canonical default per role (the seam's single source)", () => {
  expect(defaultPrompt("audit")).toBe(DEFAULT_AUDIT_PROMPT);
  expect(defaultPrompt("develop")).toContain("vow's red line");
  expect(defaultPrompt("plan")).toContain("## Verification gates");
});

test("the audit default asks for the JSON Finding shape, read-only, with a {dimension} placeholder", () => {
  expect(DEFAULT_AUDIT_PROMPT).toContain("{dimension}");
  expect(DEFAULT_AUDIT_PROMPT).toContain("title");
  expect(DEFAULT_AUDIT_PROMPT).toContain("evidence");
  expect(DEFAULT_AUDIT_PROMPT).toContain("read-only");
});

test("fillPrompt substitutes known {key}s and leaves an unknown brace as the user's literal text", () => {
  expect(fillPrompt("hi {name}, {greet}", { name: "x" })).toBe("hi x, {greet}");
});

test("renderAuditPrompt fills the live dimension, leaving no placeholder", () => {
  const rendered = renderAuditPrompt(DEFAULT_AUDIT_PROMPT, "performance");
  expect(rendered).toContain("performance");
  expect(rendered).not.toContain("{dimension}");
});

test("promptTemplates carries every role, derived from defaultPrompt (no stale copy)", () => {
  const templates = promptTemplates();
  expect(templates.map((each) => each.role).toSorted()).toEqual([...PROMPT_ROLES].toSorted());
  for (const template of templates) {
    expect(template.content).toBe(defaultPrompt(template.role));
    expect(template.path).toBe(promptRelPath(template.role));
  }
});

test("promptRelPath puts each role under the Claude-Code .claude/prompts layout", () => {
  expect(promptRelPath("develop")).toBe(".claude/prompts/develop.md");
});

test("the deep audit default carries {slice} + {dimension} placeholders and the exhaustive-coverage instruction", () => {
  expect(DEFAULT_DEEP_AUDIT_PROMPT).toContain("{slice}");
  expect(DEFAULT_DEEP_AUDIT_PROMPT).toContain("{dimension}");
  expect(DEFAULT_DEEP_AUDIT_PROMPT).toContain("EVERY file");
  expect(DEFAULT_DEEP_AUDIT_PROMPT).toContain("read-only");
});

test("renderDeepAuditPrompt fills both {dimension} and {slice}, leaving no placeholder", () => {
  const rendered = renderDeepAuditPrompt(
    DEFAULT_DEEP_AUDIT_PROMPT,
    "correctness",
    "packages/agent",
  );
  expect(rendered).toContain("correctness");
  expect(rendered).toContain("packages/agent");
  expect(rendered).not.toContain("{dimension}");
  expect(rendered).not.toContain("{slice}");
});
