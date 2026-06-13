import { TEAM, renderTeamAgent, teamTemplates } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("the team has a member for every concern — the builder + the guardians", () => {
  const names = new Set(TEAM.map((agent) => agent.name));
  // The guardians — one owner per area, each paired with its gate.
  const guardians = ["security-auditor", "layer-architect", "provider-neutrality-guard"];
  // The general builder + the domain owners that close the team (builders AND guardians).
  const closers = ["vow-developer", "a11y-keeper", "design-language-keeper", "studio-dx"];
  for (const name of [...guardians, ...closers]) {
    expect(names).toContain(name);
  }
});

test("each specialist is distinct, kebab-named, and carries a tool set + a prompt", () => {
  const names = TEAM.map((agent) => agent.name);
  // No duplicate names — each scaffolds to a distinct .claude/agents/<name>.md.
  expect(new Set(names).size).toBe(names.length);
  for (const agent of TEAM) {
    // The name is kebab-case (scaffolds to a clean .claude/agents/<name>.md filename).
    expect(agent.name).toMatch(/^[a-z][a-z\d]*(-[a-z\d]+)*$/u);
    expect(agent.tools).toContain("Read");
    expect(agent.prompt.length).toBeGreaterThan(0);
    expect(agent.description.length).toBeGreaterThan(0);
  }
});

test("the builder carries the working tool set — it edits + verifies, not read-only", () => {
  const builder = TEAM.find((agent) => agent.name === "vow-developer");
  if (!builder) {
    throw new Error("test setup: the vow-developer builder is missing from the team");
  }
  expect(builder.tools).toContain("Edit");
  expect(builder.tools).toContain("Bash");
});

test("renderTeamAgent emits Claude Code's custom-subagent md — frontmatter + the system prompt", () => {
  const [first] = TEAM;
  if (!first) {
    throw new Error("test setup: empty team");
  }
  const md = renderTeamAgent(first);
  expect(md.startsWith("---\n")).toBe(true);
  expect(md).toContain(`name: ${first.name}`);
  expect(md).toContain(`tools: ${first.tools}`);
  // The shared house-rules preamble is carried into every agent.
  expect(md).toContain("Read AGENTS.md first");
  // No model is pinned — config lives in settings, not the template.
  expect(md.includes("\nmodel:")).toBe(false);
});

test("teamTemplates scaffolds each agent to .claude/agents/<name>.md", () => {
  const templates = teamTemplates();
  expect(templates.length).toBe(TEAM.length);
  expect(templates.map((template) => template.path)).toContain(
    ".claude/agents/security-auditor.md",
  );
  for (const template of templates) {
    expect(template.path.startsWith(".claude/agents/")).toBe(true);
    expect(template.path.endsWith(".md")).toBe(true);
  }
});
