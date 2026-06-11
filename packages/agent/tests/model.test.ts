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
