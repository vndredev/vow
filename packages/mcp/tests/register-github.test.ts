// @vitest-environment node
import { AddIssue, projectId } from "../src/register-github.ts";
import { NONE, defined } from "@vow/core";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import process from "node:process";
import { z } from "zod";

/*
 * The two github tools target the same concept — a Project — and must share one resolution rule.
 * `sync_project` took an optional `project` input resolved input-then-env; `add_issue` did not. These
 * tests pin the contract parity: `AddIssue` now carries the same optional `project` field, and
 * `projectId` (the shared resolver both tools route through) prefers the input over the environment.
 * The handlers shell out to `gh`, so the resolver is exercised directly — no `gh`, fully hermetic.
 */

const ENV = "VOW_PROJECT_ID";

let saved: (typeof process.env)[string] = NONE;

beforeEach(() => {
  saved = process.env[ENV];
  Reflect.deleteProperty(process.env, ENV);
});

afterEach(() => {
  if (defined(saved)) {
    process.env[ENV] = saved;
  } else {
    Reflect.deleteProperty(process.env, ENV);
  }
});

test("add_issue's schema carries an optional `project` — the same field sync_project accepts", () => {
  expect(AddIssue.project).toBeDefined();
  const parsed = z.object(AddIssue).safeParse({
    element: "An element",
    project: "PVT_node",
    title: "A title",
    why: "A reason",
  });
  expect(parsed.success).toBe(true);
});

test("add_issue's `project` is optional — an issue with no inline project still parses", () => {
  const parsed = z.object(AddIssue).safeParse({
    element: "An element",
    title: "A title",
    why: "A reason",
  });
  expect(parsed.success).toBe(true);
});

test("projectId prefers the inline input over the environment — the shared input-then-env rule", () => {
  process.env[ENV] = "PVT_env";
  expect(projectId("PVT_input")).toBe("PVT_input");
});

test("projectId falls back to the environment when no input is given", () => {
  process.env[ENV] = "PVT_env";
  expect(projectId(NONE)).toBe("PVT_env");
});

test("projectId treats an empty input and an empty environment as absent — never a stray id", () => {
  process.env[ENV] = "";
  expect(projectId("")).toBe("");
  expect(projectId(NONE)).toBe("");
});
