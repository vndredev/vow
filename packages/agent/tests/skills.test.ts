import { SKILLS, skillRelPath, skillTemplates } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

// Each skill body must be substantially longer than its frontmatter alone.
const MIN_SKILL_CONTENT_LENGTH = 200;

test("the skill library has exactly the six engineering-discipline skills", () => {
  const names = SKILLS.map((skill) => skill.name).toSorted();
  expect(names).toEqual([
    "condition-based-waiting",
    "defense-in-depth",
    "how-to-write-a-vow-skill",
    "systematic-debugging",
    "test-first",
    "verification-before-completion",
  ]);
});

test("each skill has a kebab-case name, a when-to-use description, and a non-empty body", () => {
  for (const skill of SKILLS) {
    expect(skill.name).toMatch(/^[a-z][a-z-]+$/u);
    expect(skill.content).toContain(`name: ${skill.name}`);
    expect(skill.content).toContain("description:");
    expect(skill.content).toContain("Use when");
    expect(skill.content.length).toBeGreaterThan(MIN_SKILL_CONTENT_LENGTH);
  }
});

test("each skill content has valid YAML frontmatter", () => {
  for (const skill of SKILLS) {
    expect(skill.content.startsWith("---\n")).toBe(true);
    expect(skill.content).toContain("\n---\n");
  }
});

test("skillRelPath puts each skill under the Claude Code skills layout", () => {
  expect(skillRelPath("test-first")).toBe(".claude/skills/test-first/SKILL.md");
  expect(skillRelPath("defense-in-depth")).toBe(".claude/skills/defense-in-depth/SKILL.md");
});

test("skillTemplates scaffolds each skill to .claude/skills/<name>/SKILL.md", () => {
  const templates = skillTemplates();
  expect(templates.length).toBe(SKILLS.length);
  for (const template of templates) {
    expect(template.path.startsWith(".claude/skills/")).toBe(true);
    expect(template.path.endsWith("/SKILL.md")).toBe(true);
    expect(template.content.length).toBeGreaterThan(0);
  }
});

test("the meta-skill teaches the registration path and the gate-promotion rule", () => {
  const meta = SKILLS.find((skill) => skill.name === "how-to-write-a-vow-skill");
  if (!meta) {
    throw new Error("test setup: how-to-write-a-vow-skill is missing from SKILLS");
  }
  expect(meta.content).toContain("packages/agent/src/skills.ts");
  expect(meta.content).toContain("vow agent init");
  expect(meta.content).toContain("gate");
});

test("the verification skill requires both gates as machine-checked evidence", () => {
  const verification = SKILLS.find((skill) => skill.name === "verification-before-completion");
  if (!verification) {
    throw new Error("test setup: verification-before-completion is missing from SKILLS");
  }
  expect(verification.content).toContain("vp lint");
  expect(verification.content).toContain("pnpm -r test");
  expect(verification.content).toContain("THIS message");
});

test("the condition-based-waiting skill names the gh pr checks command, not a sleep", () => {
  const waiting = SKILLS.find((skill) => skill.name === "condition-based-waiting");
  if (!waiting) {
    throw new Error("test setup: condition-based-waiting is missing from SKILLS");
  }
  expect(waiting.content).toContain("gh pr checks");
  expect(waiting.content).toContain("--watch");
  expect(waiting.content).toContain("Never");
});
