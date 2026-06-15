/* oxlint-disable consistent-type-specifier-style -- a separate type import from the same module trips no-duplicate-imports */
import { type Maybe, defined } from "@vow/core";
import type { Names, Registrar, Studio, TextResult } from "./types.ts";
import {
  type PlanItem,
  addDep,
  addItem,
  listItems,
  openPlan,
  setPriority,
  setStatus,
} from "@vow/plan";
import path from "node:path";
import { text } from "./studio.ts";
import { z } from "zod";
/* oxlint-enable consistent-type-specifier-style */

/** The short prefix of a local item's id shown when it carries no GitHub issue number. */
const ID_SHORT = 8;

/** The plan statuses the transition tool accepts — the runtime mirror of `PlanStatus`. */
const STATUS_VALUES = ["backlog", "blocked", "doing", "done", "parked", "ready", "review"] as const;

/** An item's reference — its `#issue` when bound, else a short local id. */
function itemRef(item: PlanItem): string {
  if (defined(item.issue)) {
    return `#${item.issue}`;
  }
  return item.id.slice(0, ID_SHORT);
}

/** The ` (pillar)` suffix when an item carries a pillar, else nothing. */
function pillarSuffix(item: PlanItem): string {
  if (defined(item.pillar)) {
    return ` (${item.pillar})`;
  }
  return "";
}

/** One plan item as a line — `#42 [doing] the loop (pillar:self-building)`. */
function planLine(item: PlanItem): string {
  return `${itemRef(item)} [${item.status}] ${item.title}${pillarSuffix(item)}`;
}

/** The full plan as text, or an empty-plan note. */
function planText(root: string): string {
  const items = listItems(openPlan(root));
  if (items.length === 0) {
    return "the plan is empty";
  }
  return items.map((item) => planLine(item)).join("\n");
}

/** The message of a thrown value — an illegal transition surfaces as a clean tool result, not a crash. */
function reason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** The fields `add_plan_item` accepts (optionals as `Maybe`, the shape the MCP SDK passes the handler). */
interface AddInput {
  readonly issue: Maybe<number>;
  readonly pillar: Maybe<string>;
  readonly priority: Maybe<number>;
  readonly title: string;
}

/** Register `add_plan_item` — open a new backlog item, bound to an issue or local-only. */
function registerAdd(server: Registrar, names: Names, root: string): void {
  const tool = names.at("add_plan_item");
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: {
        issue: z.number().optional(),
        pillar: z.string().optional(),
        priority: z.number().optional(),
        title: z.string(),
      },
    },
    (input: AddInput): TextResult => text(`added ${planLine(addItem(openPlan(root), input))}`),
  );
}

/** Register `list_plan` — the whole plan as text. */
function registerList(server: Registrar, names: Names, root: string): void {
  const tool = names.at("list_plan");
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: {} },
    (): TextResult => text(planText(root)),
  );
}

/** Register `set_plan_status` — transition an item, reporting an illegal move as a result, not a crash. */
function registerStatus(server: Registrar, names: Names, root: string): void {
  const tool = names.at("set_plan_status");
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: { id: z.string(), status: z.enum(STATUS_VALUES) },
    },
    (input: {
      readonly id: string;
      readonly status: (typeof STATUS_VALUES)[number];
    }): TextResult => {
      try {
        const item = setStatus(openPlan(root), input.id, input.status);
        if (!defined(item)) {
          return text(`no plan item ${input.id}`);
        }
        return text(planLine(item));
      } catch (error: unknown) {
        return text(reason(error));
      }
    },
  );
}

/** Register `add_plan_dep` — add an edge to the plan DAG (`item` blocked by `dependsOn`). */
function registerDep(server: Registrar, names: Names, root: string): void {
  const tool = names.at("add_plan_dep");
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: { dependsOn: z.string(), item: z.string() } },
    (input: { readonly dependsOn: string; readonly item: string }): TextResult => {
      addDep(openPlan(root), input.item, input.dependsOn);
      return text(`${input.item} now depends on ${input.dependsOn}`);
    },
  );
}

/** Register `set_plan_priority` — re-rank an item (higher sorts first in the ready-queue). */
function registerPriority(server: Registrar, names: Names, root: string): void {
  const tool = names.at("set_plan_priority");
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: { id: z.string(), priority: z.number() } },
    (input: { readonly id: string; readonly priority: number }): TextResult => {
      const item = setPriority(openPlan(root), input.id, input.priority);
      if (!defined(item)) {
        return text(`no plan item ${input.id}`);
      }
      return text(`${planLine(item)} — priority ${item.priority}`);
    },
  );
}

/**
 * Register the local-plan tools — vow's own plan (a SQLite DAG bound to thin issues) driven the same way
 * issues are. The agent + operator add items, transition them through the vow-owned lifecycle, declare
 * dependencies, re-rank, and list — never via the GitHub API.
 */
export function registerPlan(server: Registrar, names: Names, studio: Studio): void {
  const root = path.dirname(studio.appDir);
  registerAdd(server, names, root);
  registerList(server, names, root);
  registerStatus(server, names, root);
  registerDep(server, names, root);
  registerPriority(server, names, root);
}
