import { TEAM, renderTeamAgent, teamTemplates } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("the team has a distinct specialist per concern, each with a tool set + a prompt", () => {
  const names = TEAM.map((agent) => agent.name);
  expect(names).toContain("security-auditor");
  expect(names).toContain("layer-architect");
  expect(names).toContain("provider-neutrality-guard");
  // No duplicate names — each scaffolds to a distinct .claude/agents/<name>.md.
  expect(new Set(names).size).toBe(names.length);
  for (const agent of TEAM) {
    expect(agent.tools).toContain("Read");
    expect(agent.prompt.length).toBeGreaterThan(0);
    expect(agent.description.length).toBeGreaterThan(0);
  }
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
