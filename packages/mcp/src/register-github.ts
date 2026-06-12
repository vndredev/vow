import type { Maybe, Names, Registrar, Studio, TextResult } from "./types.ts";
import {
  addToProject,
  assignIssue,
  closeIssue,
  createIssue,
  featureIssueBody,
  issuePlan,
  syncProjectStatus,
} from "@vow/observability";
import { json, text } from "./studio.ts";
import { defined } from "@vow/core";
import process from "node:process";
import { z } from "zod";

/** The shape `add_issue` parses — the feature-issue fields plus the optional toolkit extras. */
export const AddIssue = {
  assignee: z.string().optional(),
  element: z.string(),
  labels: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  project: z.string().optional(),
  title: z.string(),
  why: z.string(),
};

interface AddIssueInput {
  readonly assignee: Maybe<string>;
  readonly element: string;
  readonly labels: Maybe<readonly string[]>;
  readonly milestone: Maybe<string>;
  readonly project: Maybe<string>;
  readonly title: string;
  readonly why: string;
}

/** The configured Project node id from the environment — absent (or empty) when unset. */
function envProjectId(): Maybe<string> {
  const env = process.env["VOW_PROJECT_ID"];
  if (defined(env) && env !== "") {
    return env;
  }
  return env;
}

/** A present, non-empty project id from the input or the environment — absent otherwise. */
export function projectId(given: Maybe<string>): Maybe<string> {
  if (defined(given) && given !== "") {
    return given;
  }
  return envProjectId();
}

/** The assignee to use — the given one, or `@me` (the full toolkit: assigned by default). */
function assigneeOf(given: Maybe<string>): string {
  if (defined(given)) {
    return given;
  }
  return "@me";
}

/** The optional `milestone` field as a spreadable fragment — empty when absent. */
function milestoneOf(given: Maybe<string>): { readonly milestone?: string } {
  if (defined(given)) {
    return { milestone: given };
  }
  return {};
}

/** Open an issue, then (when a Project is configured) add it. */
function openIssue(appDir: string, input: AddIssueInput): TextResult {
  const url = createIssue(appDir, {
    assignee: assigneeOf(input.assignee),
    body: featureIssueBody({ element: input.element, why: input.why }),
    labels: ["enhancement", ...(input.labels ?? [])],
    title: input.title,
    ...milestoneOf(input.milestone),
  });
  const project = projectId(input.project);
  if (defined(project)) {
    addToProject(appDir, project, url);
    return text(`opened ${url} — assigned + added to the Project`);
  }
  return text(`opened ${url}`);
}

/** Register the issue tools — list the plan, open an issue, close + assign one. */
function registerIssues(server: Registrar, names: Names, appDir: string): void {
  const listIssues = names.at("list_issues");
  const addIssue = names.at("add_issue");
  const closeIssueTool = names.at("close_issue");
  const assignIssueTool = names.at("assign_issue");

  server.registerTool(
    listIssues.name,
    { description: listIssues.description, inputSchema: {} },
    () => json(issuePlan(appDir)),
  );

  server.registerTool(
    addIssue.name,
    { description: addIssue.description, inputSchema: AddIssue },
    (input: AddIssueInput): TextResult => openIssue(appDir, input),
  );

  server.registerTool(
    closeIssueTool.name,
    { description: closeIssueTool.description, inputSchema: { number: z.number() } },
    (input: { readonly number: number }): TextResult => {
      closeIssue(appDir, input.number);
      return text(`closed #${input.number}`);
    },
  );

  server.registerTool(
    assignIssueTool.name,
    {
      description: assignIssueTool.description,
      inputSchema: { assignee: z.string(), number: z.number() },
    },
    (input: { readonly assignee: string; readonly number: number }): TextResult => {
      assignIssue(appDir, input.number, input.assignee);
      return text(`assigned #${input.number} to ${input.assignee}`);
    },
  );
}

/** Register the Project tool — reconcile the Project's Status field with the derived status. */
function registerProject(server: Registrar, names: Names, appDir: string): void {
  const syncProject = names.at("sync_project");

  server.registerTool(
    syncProject.name,
    { description: syncProject.description, inputSchema: { project: z.string().optional() } },
    (input: { readonly project: Maybe<string> }): TextResult => {
      const pid = projectId(input.project);
      if (defined(pid)) {
        return json(syncProjectStatus(appDir, pid));
      }
      return text("set VOW_PROJECT_ID (in .mcp.json) or pass `project` — the Project node id");
    },
  );
}

/** Register the github tools — the plan lives as issues + a Project; gh is the source. */
export function registerGithub(server: Registrar, names: Names, studio: Studio): void {
  registerIssues(server, names, studio.appDir);
  registerProject(server, names, studio.appDir);
}
