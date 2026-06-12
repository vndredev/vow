// @vitest-environment node
import { AddIssue, openedReport, projectFailedReport, projectId } from "../src/register-github.ts";
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
  expect(defined(projectId(""))).toBe(false);
  expect(defined(projectId(NONE))).toBe(false);
});

test("the partial-success report always carries the issue URL — a Project-add failure never loses it", () => {
  const url = "https://github.com/vndredev/vow/issues/9";
  const report = projectFailedReport(url, new Error("bad VOW_PROJECT_ID"));
  expect(report).toContain(url);
  expect(report).toContain("bad VOW_PROJECT_ID");
});

test("the partial-success report instructs the LLM not to re-create — no duplicate over a half write", () => {
  const report = projectFailedReport("https://example/issues/1", new Error("network"));
  expect(report).toContain("do NOT re-create it");
  expect(report).toContain("retry sync_project");
});

test("the partial-success report stringifies a non-Error throw — the URL still survives", () => {
  const url = "https://example/issues/2";
  const report = projectFailedReport(url, "raw string failure");
  expect(report).toContain(url);
  expect(report).toContain("raw string failure");
});

test("the success report names the URL and the Project — both phases of the write done", () => {
  const url = "https://example/issues/3";
  expect(openedReport(url)).toContain(url);
  expect(openedReport(url)).toContain("Project");
});
