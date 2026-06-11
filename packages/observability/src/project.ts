import type { IssueStatus, Maybe, PlanItem, StatusChange, SyncResult } from "./types.ts";
import { NONE } from "./none.ts";
import { execFileSync } from "node:child_process";
import { issuePlan } from "./github.ts";

/**
 * The Project sync side of @vow/observability: the studio's derived status is the truth; write it onto
 * the GitHub Project's Status field so its board/views match 1:1 (catching the drift the Project's own
 * workflows miss). Every `gh api graphql` result is narrowed through a type guard — no unsafe casts.
 */

export type { StatusChange, SyncResult } from "./types.ts";

/** The GitHub Project Status option for a derived status (planned -> Todo, doing -> In Progress, done ->
    Done). Pure. */
export function statusOption(status: IssueStatus): string {
  if (status === "done") {
    return "Done";
  }
  if (status === "doing") {
    return "In Progress";
  }
  return "Todo";
}

/** A record-shaped value, used by the guards to walk an unknown `gh api graphql` payload. */
type Json = Record<string, unknown>;

/** Whether a value is a non-null object — the entry point for safely reading a graphql payload. */
function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null;
}

/** Read a child object off a json value, or absent. */
function readObject(value: unknown, key: string): Maybe<Json> {
  if (isJson(value)) {
    const child: unknown = value[key];
    if (isJson(child)) {
      return child;
    }
  }
  return NONE;
}

/** Read a string property off a json value, or absent. */
function readString(value: unknown, key: string): Maybe<string> {
  if (isJson(value)) {
    const child: unknown = value[key];
    if (typeof child === "string") {
      return child;
    }
  }
  return NONE;
}

/** Read a number property off a json value, or absent. */
function readNumber(value: unknown, key: string): Maybe<number> {
  if (isJson(value)) {
    const child: unknown = value[key];
    if (typeof child === "number") {
      return child;
    }
  }
  return NONE;
}

/** Read an array property off a json value, or `[]`. */
function readArray(value: unknown, key: string): readonly unknown[] {
  if (isJson(value)) {
    const child: unknown = value[key];
    if (Array.isArray(child)) {
      return child;
    }
  }
  return [];
}

/** A graphql Status field: the field id + its single-select options. */
interface StatusField {
  readonly id: string;
  readonly options: readonly { readonly id: string; readonly name: string }[];
}

/** One Project item: its node id, optional linked issue number, optional current Status name. */
interface ProjectItem {
  readonly id: string;
  readonly number: Maybe<number>;
  readonly status: Maybe<string>;
}

/** A graphql variable bound by `gh api graphql -f name=value` — never interpolated into the query text. */
interface GqlVar {
  readonly name: string;
  readonly value: string;
}

/** The `gh api graphql` args for a query + its bound variables — each value passed via `-f`, so a caller-
 *  supplied id is bound by the API, never embedded in (and thus able to inject) the query text. */
export function graphqlArgs(query: string, vars: readonly GqlVar[]): string[] {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const variable of vars) {
    args.push("-f", `${variable.name}=${variable.value}`);
  }
  return args;
}

/** Run a `gh api graphql` query with bound `vars` and return the parsed `data` (`{}` on an odd shape). */
function ghJsonData(cwd: string, query: string, vars: readonly GqlVar[]): Json {
  const parsed: unknown = JSON.parse(
    execFileSync("gh", graphqlArgs(query, vars), { cwd, encoding: "utf8" }),
  );
  return readObject(parsed, "data") ?? {};
}

/** Narrow one graphql option node into `{ id, name }`, or absent when malformed. */
function readOption(raw: unknown): Maybe<{ id: string; name: string }> {
  const id = readString(raw, "id");
  const name = readString(raw, "name");
  if (typeof id === "string" && typeof name === "string") {
    return { id, name };
  }
  return NONE;
}

/** Narrow a graphql `node.field` payload into a `StatusField`, throwing when it is malformed. */
export function readStatusField(data: Readonly<Json>): StatusField {
  const field = readObject(data, "node")?.["field"];
  const id = readString(field, "id");
  if (typeof id !== "string") {
    throw new TypeError("the Project has no Status field");
  }
  const options: { id: string; name: string }[] = [];
  for (const raw of readArray(field, "options")) {
    const option = readOption(raw);
    if (typeof option === "object") {
      options.push(option);
    }
  }
  return { id, options };
}

/** Narrow one graphql item node into a `ProjectItem`, or absent when it has no id. */
function readItem(raw: unknown): Maybe<ProjectItem> {
  const id = readString(raw, "id");
  if (typeof id !== "string") {
    return NONE;
  }
  const content = readObject(raw, "content");
  const fieldValue = readObject(raw, "fieldValueByName");
  return { id, number: readNumber(content, "number"), status: readString(fieldValue, "name") };
}

/** Narrow a graphql `node.items.nodes` payload into `ProjectItem`s (skipping any malformed node). */
export function readProjectItems(data: Readonly<Json>): ProjectItem[] {
  const items = readObject(data, "node")?.["items"];
  const out: ProjectItem[] = [];
  for (const raw of readArray(items, "nodes")) {
    const item = readItem(raw);
    if (typeof item === "object") {
      out.push(item);
    }
  }
  return out;
}

const fieldQuery = `query($pid:ID!){node(id:$pid){... on ProjectV2{field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}}}}`;

const itemsQuery = `query($pid:ID!){node(id:$pid){... on ProjectV2{items(first:100){nodes{id content{... on Issue{number}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}`;

const setStatusMutation = `mutation($pid:ID!,$item:ID!,$field:ID!,$opt:String!){updateProjectV2ItemFieldValue(input:{projectId:$pid,itemId:$item,fieldId:$field,value:{singleSelectOptionId:$opt}}){projectV2Item{id}}}`;

/** Resolve a Status option id by name from a `StatusField`, throwing when the option is absent. */
function resolveOption(field: Readonly<StatusField>, name: string): string {
  const option = field.options.find((opt) => opt.name === name);
  if (typeof option === "object") {
    return option.id;
  }
  throw new RangeError(`the Project has no Status option "${name}"`);
}

/** Index the Project items by their linked issue number (items without a number are skipped). */
function itemsByNumber(items: readonly ProjectItem[]): Map<number, ProjectItem> {
  const byNumber = new Map<number, ProjectItem>();
  for (const item of items) {
    if (typeof item.number === "number") {
      byNumber.set(item.number, item);
    }
  }
  return byNumber;
}

/** The fixed context of one sync run — the connection target and the Project's resolved Status field. */
interface SyncContext {
  readonly cwd: string;
  readonly field: StatusField;
  readonly projectId: string;
}

/** What one issue wants on the Project: its number, its Project item, and the target Status name. */
interface Wanted {
  readonly item: ProjectItem;
  readonly number: number;
  readonly want: string;
}

/** The status change an item needs — `NONE` when its `current` status already matches `want`, else the
 *  change. The pure reconcile decision, separate from applying it (so the riskiest sync logic is testable
 *  without touching GitHub). */
export function statusChangeFor(
  current: Maybe<string>,
  number: number,
  want: string,
): Maybe<StatusChange> {
  if (current === want) {
    return NONE;
  }
  return { from: current ?? "(unset)", number, to: want };
}

/** Apply one issue's wanted status to its Project item, reporting the change (`NONE` when already matched). */
function reconcileItem(
  context: Readonly<SyncContext>,
  wanted: Readonly<Wanted>,
): Maybe<StatusChange> {
  const { item, number, want } = wanted;
  const change = statusChangeFor(item.status, number, want);
  if (typeof change !== "object") {
    return NONE;
  }
  ghJsonData(context.cwd, setStatusMutation, [
    { name: "pid", value: context.projectId },
    { name: "item", value: item.id },
    { name: "field", value: context.field.id },
    { name: "opt", value: resolveOption(context.field, want) },
  ]);
  return change;
}

/**
 * Sync a GitHub Project's Status field to the studio's derived issue status (the studio is the source of
 * truth). For every issue on the plan, set its Project Status to match `deriveIssueStatus` — planned ->
 * Todo, doing -> In Progress, done -> Done — and report what changed. Throws on a `gh` failure.
 */
export function syncProjectStatus(cwd: string, projectId: string): SyncResult {
  const pid = [{ name: "pid", value: projectId }];
  const field = readStatusField(ghJsonData(cwd, fieldQuery, pid));
  const context: SyncContext = { cwd, field, projectId };
  const byNumber = itemsByNumber(readProjectItems(ghJsonData(cwd, itemsQuery, pid)));
  const wanted = (plan: PlanItem): Maybe<Wanted> => {
    const item = byNumber.get(plan.issue.number);
    if (typeof item === "object") {
      return { item, number: plan.issue.number, want: statusOption(plan.status) };
    }
    return NONE;
  };
  const steps = issuePlan(cwd)
    .map((plan) => wanted(plan))
    .filter((step): step is Wanted => typeof step === "object");
  const changes = steps.map((step) => reconcileItem(context, step));
  const changed = changes.filter((change): change is StatusChange => typeof change === "object");
  return { changed, matched: changes.length - changed.length };
}

/** Add an issue/PR (by URL) to a GitHub Project — resolves the Project's number + owner from its node
    id, then `gh project item-add`. Throws on failure. */
export function addToProject(cwd: string, projectId: string, url: string): void {
  const data = ghJsonData(
    cwd,
    `query($pid:ID!){node(id:$pid){... on ProjectV2{number owner{... on User{login} ... on Organization{login}}}}}`,
    [{ name: "pid", value: projectId }],
  );
  const node = readObject(data, "node");
  const number = readNumber(node, "number");
  const login = readString(readObject(node, "owner"), "login");
  if (typeof number !== "number" || typeof login !== "string") {
    throw new TypeError("the Project node has no number/owner");
  }
  execFileSync("gh", ["project", "item-add", String(number), "--owner", login, "--url", url], {
    cwd,
    encoding: "utf8",
  });
}
