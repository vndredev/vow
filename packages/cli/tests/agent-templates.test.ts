import {
  agentsMd,
  vowAuditSkill,
  vowBrainstormSkill,
  vowDevelopSkill,
  vowOrchestrateSkill,
} from "../src/agent-templates.ts";
import { expect, test } from "vite-plus/test";
import { agentHelp } from "../src/agent.ts";
import { fileURLToPath } from "node:url";
import { promptRelPath } from "@vow/agent";
import { readFileSync } from "node:fs";

// The four skills `vow agent init` scaffolds — the user-facing wording must name every one (1:1).
const INIT_SKILLS = ["develop", "orchestrate", "audit", "brainstorm"] as const;

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

test("the AGENTS.md contract states the red line + the gates", () => {
  const md = agentsMd();
  expect(md).toContain("# AGENTS.md");
  expect(md).toContain("vp check");
  expect(md).toContain("Closes #N");
  expect(md).toContain("provider-neutrality");
});

test("the vow-develop skill carries valid frontmatter + points at the scaffolded prompt", () => {
  const skill = vowDevelopSkill();
  expect(skill).toContain("name: vow-develop");
  // A POINTER, not a copy: the operative instruction is the single source of truth at this path.
  expect(skill).toContain(promptRelPath("develop"));
  expect(skill).toContain(".claude/prompts/develop.md");
});

test("the vow-orchestrate skill points at the host workflow (live), not a passive bash", () => {
  const skill = vowOrchestrateSkill();
  expect(skill).toContain("name: vow-orchestrate");
  expect(skill).toContain("Workflow tool");
  expect(skill).toContain("/workflows");
  expect(skill).toContain("vow agent plan");
  expect(skill).toContain("PASSIVE");
});

test("the vow-audit skill files findings into vow issues, via the host workflow", () => {
  const skill = vowAuditSkill();
  expect(skill).toContain("name: vow-audit");
  expect(skill).toContain("vow agent audit --prompt");
  expect(skill).toContain("vow agent audit --file");
  expect(skill).toContain("/workflows");
});

test("the vow-brainstorm skill has a hard gate, the spec format, and provider-neutral issue filing", () => {
  const skill = vowBrainstormSkill();
  expect(skill).toContain("name: vow-brainstorm");
  // The hard gate is the point — approval must be explicit before any file is written.
  expect(skill).toContain("HARD GATE");
  // The spec format teaches the agent what a .vow.md looks like.
  expect(skill).toContain(".vow.md");
  // Provider-neutral: the issue is filed via gh, never a provider CLI.
  expect(skill).toContain("gh issue create");
  // The Socratic constraint: one question at a time, never a list.
  expect(skill).toContain("one question");
});

test("the vow-audit skill points at the scaffolded prompt as the operative instruction", () => {
  const skill = vowAuditSkill();
  // The per-dimension instruction is the single source of truth, not restated in the skill.
  expect(skill).toContain(promptRelPath("audit"));
  expect(skill).toContain(".claude/prompts/audit.md");
});

test("the CLI help string names every skill init scaffolds (no undercount)", () => {
  expect(agentHelp()).toContain(`${INIT_SKILLS.join("/")} skills`);
});

test("the init doc comment names the skills + the operative prompts it scaffolds", () => {
  const comment = source("../src/agent.ts");
  expect(comment).toContain("develop/orchestrate/audit/brainstorm skills");
  expect(comment).toContain("develop/audit/plan PROMPTS");
});

test("cli.md documents init scaffolding every skill, not just develop", () => {
  const doc = source("../../../docs/guide/cli.md");
  expect(doc).toContain(`the ${INIT_SKILLS.join("/")} skills`);
});
