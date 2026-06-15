import type { Maybe, Names, Registrar, Studio, TextResult } from "./types.ts";
import {
  assignIssue,
  closeIssue,
  createIssue,
  featureIssueBody,
  issuePlan,
  reopenIssue,
} from "@vow/observability";
import { json, text } from "./studio.ts";
import { defined } from "@vow/core";
import { z } from "zod";

/** The shape `add_issue` parses — the feature-issue fields plus the optional toolkit extras. */
export const AddIssue = {
  assignee: z.string().optional(),
  element: z.string(),
  labels: z.array(z.string()).optional(),
  title: z.string(),
  why: z.string(),
};

interface AddIssueInput {
  readonly assignee: Maybe<string>;
  readonly element: string;
  readonly labels: Maybe<readonly string[]>;
  readonly title: string;
  readonly why: string;
}

/** The assignee to use — the given one, or `@me` (the full toolkit: assigned by default). */
function assigneeOf(given: Maybe<string>): string {
  if (defined(given)) {
    return given;
  }
  return "@me";
}

/** Open an issue and report its URL. The throughline pillar + phase now live on the local `@vow/plan`
 *  item (`sync_plan` ingests the issue), not a routed GitHub label or milestone. */
function openIssue(appDir: string, input: AddIssueInput): TextResult {
  const url = createIssue(appDir, {
    assignee: assigneeOf(input.assignee),
    body: featureIssueBody({ element: input.element, why: input.why }),
    labels: ["enhancement", ...(input.labels ?? [])],
    title: input.title,
  });
  return text(`opened ${url}`);
}

/** Register the issue tools — list the plan, open an issue, close + assign one. */
function registerIssues(server: Registrar, names: Names, appDir: string): void {
  const listIssues = names.at("list_issues");
  const addIssue = names.at("add_issue");
  const closeIssueTool = names.at("close_issue");
  const reopenIssueTool = names.at("reopen_issue");
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
    reopenIssueTool.name,
    { description: reopenIssueTool.description, inputSchema: { number: z.number() } },
    (input: { readonly number: number }): TextResult => {
      reopenIssue(appDir, input.number);
      return text(`reopened #${input.number}`);
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

/** Register the github tools — the plan lives as issues; gh is the source. */
export function registerGithub(server: Registrar, names: Names, studio: Studio): void {
  registerIssues(server, names, studio.appDir);
}
