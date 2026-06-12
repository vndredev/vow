import {
  PROMPT_ROLES,
  defaultPrompt,
  promptRelPath,
  promptTemplates,
  renderAuditPrompt,
} from "@vow/agent";
import { expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { promptPath, readPrompt } from "../src/agent-prompts.ts";
import path from "node:path";
import { tmpdir } from "node:os";

/** A prompt role — re-derived locally (the test pins behaviour, not types), so it needs no type import. */
type Role = (typeof PROMPT_ROLES)[number];

/** A throwaway repo root for the file-glue tests — scaffold/read prompts here, then tear it down. */
function tempRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "vow-prompts-"));
}

/** Write `content` to `role`'s scaffolded path under `cwd`, creating the `.claude/prompts` dir. */
function scaffoldPrompt(cwd: string, role: Role, content: string): void {
  const file = path.join(cwd, promptRelPath(role));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

test("readPrompt falls back to the built-in default when no prompt is scaffolded", () => {
  const cwd = tempRepo();
  try {
    for (const role of PROMPT_ROLES) {
      expect(readPrompt(cwd, role)).toBe(defaultPrompt(role));
    }
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("readPrompt returns the scaffolded file's content when present (a user edit drives the agent)", () => {
  const cwd = tempRepo();
  try {
    scaffoldPrompt(cwd, "audit", "Audit for {dimension}: my own rules.");
    expect(readPrompt(cwd, "audit")).toBe("Audit for {dimension}: my own rules.");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("the seam can't lie: init writes EXACTLY what the reader falls back to (one source of truth)", () => {
  for (const template of promptTemplates()) {
    // What `vow agent init` writes for the role == the reader's built-in fallback for that role.
    expect(template.content).toBe(defaultPrompt(template.role));
    // And the manifest path is the same path the reader resolves.
    expect(template.path).toBe(promptRelPath(template.role));
  }
});

test("promptTemplates covers every role, each under .claude/prompts/<role>.md", () => {
  const roles = promptTemplates().map((each) => each.role);
  expect(roles.toSorted()).toEqual([...PROMPT_ROLES].toSorted());
  for (const template of promptTemplates()) {
    expect(template.path).toBe(`.claude/prompts/${template.role}.md`);
  }
});

test("renderAuditPrompt fills {dimension} into the scaffolded (or default) audit template", () => {
  const cwd = tempRepo();
  try {
    const rendered = renderAuditPrompt(readPrompt(cwd, "audit"), "security");
    expect(rendered).toContain("security");
    expect(rendered).not.toContain("{dimension}");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("promptPath resolves the role under the repo root", () => {
  expect(promptPath("/repo", "plan")).toBe(path.join("/repo", ".claude", "prompts", "plan.md"));
});
