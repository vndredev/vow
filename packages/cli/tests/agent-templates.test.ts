import { agentsMd, vowDevelopSkill, vowOrchestrateSkill } from "../src/agent-templates.ts";
import { expect, test } from "vite-plus/test";

test("the AGENTS.md contract states the red line + the gates", () => {
  const md = agentsMd();
  expect(md).toContain("# AGENTS.md");
  expect(md).toContain("vp check");
  expect(md).toContain("Closes #N");
  expect(md).toContain("provider-neutrality");
});

test("the vow-develop skill carries valid frontmatter + the develop steps", () => {
  const skill = vowDevelopSkill();
  expect(skill).toContain("name: vow-develop");
  expect(skill).toContain("gh pr merge");
});

test("the vow-orchestrate skill points at the host workflow (live), not a passive bash", () => {
  const skill = vowOrchestrateSkill();
  expect(skill).toContain("name: vow-orchestrate");
  expect(skill).toContain("Workflow tool");
  expect(skill).toContain("/workflows");
  expect(skill).toContain("vow agent plan");
  expect(skill).toContain("PASSIVE");
});
