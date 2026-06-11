import { claudeCode, codex, gemini, modelFor } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const POLICY = { audit: "big", execute: "small", plan: "big" };

test("modelFor resolves a role to its model under the policy", () => {
  expect(modelFor(POLICY, "execute")).toBe("small");
  expect(modelFor(POLICY, "audit")).toBe("big");
  expect(modelFor(POLICY, "plan")).toBe("big");
});

test("each provider emits its own model flag when the task pins a model", () => {
  const task = { branch: "b", cwd: ".", model: "the-model", plan: "p", title: "t" };
  expect(claudeCode.command(task).args).toContain("the-model");
  expect(codex.command(task).args).toContain("the-model");
  expect(gemini.command(task).args).toContain("the-model");
});

test("a provider omits the model flag when the task pins no model", () => {
  const task = { branch: "b", cwd: ".", plan: "p", title: "t" };
  expect(claudeCode.command(task).args).not.toContain("--model");
});

test("claudeCode audits + plans on Fable by default (the hard roles), executes on a cheaper model", () => {
  expect(modelFor(claudeCode.models, "audit")).toBe("claude-fable-5");
  expect(modelFor(claudeCode.models, "plan")).toBe("claude-fable-5");
  expect(modelFor(claudeCode.models, "execute")).not.toBe(modelFor(claudeCode.models, "plan"));
});

test("an un-tuned provider defaults to its own brain — no model override per role", () => {
  expect(modelFor(codex.models, "execute")).toBe("");
});

test("a provider strips its API key by default (subscription auth), keeps it on --auth api", () => {
  const base = { branch: "b", cwd: ".", plan: "p", title: "t" };
  expect(claudeCode.command(base).unsetEnv).toContain("ANTHROPIC_API_KEY");
  expect(claudeCode.command({ auth: "api", ...base }).unsetEnv).toEqual([]);
});
