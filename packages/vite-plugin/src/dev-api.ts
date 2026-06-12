// oxlint-disable prefer-readonly-parameter-types -- this module bridges the mutable Node http + db objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Db, get, insert, list, remove, update } from "@vow/db";
import type { IncomingMessage, ServerResponse } from "node:http";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Maybe, type ReadonlyVow, defined, isRecord } from "@vow/core";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type PlanItem, closeIssue, issuePlan, reopenIssue } from "@vow/observability";
import { NONE } from "./none.ts";
import { mutable } from "./mutable.ts";

/**
 * The dev HTTP layer — the connect-style middlewares the dev server mounts under `/__vow`.
 *
 * The routing is pure: `dataReply` turns a parsed request into a `Reply` value (status + optional JSON
 * body), and exactly one thin function (`writeReply`) touches the mutable `ServerResponse`. Every function
 * here unavoidably carries an external mutable object (the Node `req`/`res` or the `@vow/db` handle), so
 * `prefer-readonly-parameter-types` is disabled for this single I/O module — the only place it cannot hold.
 */

// The shared dev-API route shape (the mount prefixes), re-exported so the plugin mounts on the one contract.
export { VOW_API } from "@vow/db/routes";

/** The status codes the data + issue APIs answer with — named so the replies read as intent. */
const STATUS = {
  badRequest: 400,
  created: 201,
  noContent: 204,
  notAllowed: 405,
  notFound: 404,
  ok: 200,
  serverError: 500,
} as const;

/** The TTL (ms) of the issue-plan cache — `gh` shells synchronously, so a poll must not block per call. */
const ISSUE_CACHE_TTL = 10_000;

/** A computed response — a status, and a body to serialize as JSON (absent body → an empty response). */
interface Reply {
  readonly status: number;
  readonly body?: unknown;
}

/** A parsed data request — the resolved entity, the method, the raw JSON body, and the optional record id. */
interface DataRequest {
  readonly db: Db;
  readonly entity: ReadonlyVow;
  readonly method: string;
  readonly body: string;
}

/** A connect-style middleware: read the request, write the response, or pass to the next handler. */
type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

/**
 * Ignore a promise that handles its own errors — keeps the middleware sync without a floating promise.
 * Passing the promise here counts as handling it; `serveData` catches everything (it writes a 500 on
 * failure), so nothing is left to await in the synchronous middleware.
 */
function ignore(promise: Promise<void>): boolean {
  return promise instanceof Promise;
}

/** The error message of an unknown throw — a string guard, never a cast to `Error`. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/** Apply a computed reply to the response — the one place the mutable `ServerResponse` is written. */
function writeReply(res: ServerResponse, reply: Reply): void {
  res.statusCode = reply.status;
  if (defined(reply.body)) {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(reply.body));
    return;
  }
  res.end();
}

/** Read the full request body as a string. */
async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of req) {
    chunks.push(String(chunk));
  }
  return chunks.join("");
}

/** Parse a raw body as a JSON record — an empty body (or a non-object payload) is the empty record. */
function parseBody(raw: string): Record<string, unknown> {
  if (raw === "") {
    return {};
  }
  const parsed: unknown = JSON.parse(raw);
  if (isRecord(parsed)) {
    return parsed;
  }
  return {};
}

/** The reply status for a record lookup — found is OK, absent is 404. */
function recordStatus(record: Maybe<unknown>): number {
  if (defined(record)) {
    return STATUS.ok;
  }
  return STATUS.notFound;
}

/** The reply for a delete — 204 when a row was removed, 404 when there was nothing to remove. */
function deleteStatus(removed: boolean): number {
  if (removed) {
    return STATUS.noContent;
  }
  return STATUS.notFound;
}

/** Route a collection request (`/__vow/db/<slug>`) to a reply — GET lists, POST inserts. */
function collectionReply(request: DataRequest): Reply {
  const { db, entity, method, body } = request;
  const target = mutable(entity);
  if (method === "GET") {
    return { body: list(db, target), status: STATUS.ok };
  }
  if (method === "POST") {
    return { body: insert(db, target, parseBody(body)), status: STATUS.created };
  }
  return { status: STATUS.notAllowed };
}

/** Route a write to a single record (`PATCH`/`DELETE`) to a reply. */
function itemWriteReply(request: DataRequest, id: string): Reply {
  const { db, entity, method, body } = request;
  const target = mutable(entity);
  if (method === "PATCH") {
    const record = update(db, target, id, parseBody(body));
    return { body: record, status: recordStatus(record) };
  }
  if (method === "DELETE") {
    return { status: deleteStatus(remove(db, target, id)) };
  }
  return { status: STATUS.notAllowed };
}

/** Route an item request (`/__vow/db/<slug>/<id>`) to a reply — GET reads, the rest write. */
function itemReply(request: DataRequest, id: string): Reply {
  if (request.method === "GET") {
    const record = get(request.db, mutable(request.entity), id);
    return { body: record, status: recordStatus(record) };
  }
  return itemWriteReply(request, id);
}

/** Route a parsed data request to a reply — an id selects the item handler, else the collection handler. */
function dataReply(request: DataRequest, id: Maybe<string>): Reply {
  if (defined(id)) {
    return itemReply(request, id);
  }
  return collectionReply(request);
}

/** The `<slug>` and optional `<id>` parsed from a `/__vow/db` request path. */
function parsePath(url: Maybe<string>): { slug: Maybe<string>; id: Maybe<string> } {
  const segments = (url ?? "/").split("?")[0]?.replace(/^\/+/u, "").split("/");
  return { id: segments?.[1], slug: segments?.[0] };
}

/** The resolved route of a data request — the DB handle, the target entity, and the optional record id. */
interface Route {
  readonly db: Db;
  readonly entity: ReadonlyVow;
  readonly id: Maybe<string>;
}

/** Read the body, route the request, and write the reply — answers a 500 on any read/route failure. */
async function serveData(req: IncomingMessage, res: ServerResponse, route: Route): Promise<void> {
  const { db, entity, id } = route;
  try {
    const body = await readBody(req);
    writeReply(res, dataReply({ body, db, entity, method: req.method ?? "GET" }, id));
  } catch (error) {
    writeReply(res, { body: { error: errorMessage(error) }, status: STATUS.serverError });
  }
}

/**
 * The dev data API — `/__vow/db/<slug>[/<id>]` over `@vow/db`. `db`/`entities` are read live through the
 * getters so a regenerate keeps the served schema in sync.
 */
export function dataApi(
  getDb: () => Maybe<Db>,
  getEntities: () => readonly ReadonlyVow[],
): Middleware {
  return (req, res, next) => {
    const db = getDb();
    const { slug, id } = parsePath(req.url);
    const entity = getEntities().find((candidate) => candidate.slug === slug);
    if (!defined(db) || !defined(entity)) {
      next();
      return;
    }
    ignore(serveData(req, res, { db, entity, id }));
  };
}

/** The issue plan with the timestamp it was fetched — a short TTL keeps polling from re-shelling `gh`. */
interface IssueCache {
  readonly at: number;
  readonly plan: readonly PlanItem[];
}

/** A parsed issue-write request — close or reopen a numbered issue (the actions the UI shares with the MCP). */
interface IssueWrite {
  readonly action: "close" | "reopen";
  readonly issue: number;
}

/** Parse + validate an issue-write body (`{ action: "close" | "reopen", number }`) — absent when malformed. */
function parseIssueWrite(body: string): Maybe<IssueWrite> {
  const { action, number } = parseBody(body);
  if ((action === "close" || action === "reopen") && typeof number === "number") {
    return { action, issue: number };
  }
  return NONE;
}

/** The issue-plan cache slot — the GET reader and the POST writer share one (one dev server, one cwd). */
interface IssueState {
  readonly cwd: string;
  cache: Maybe<IssueCache>;
}

/** Re-shell `gh` into a fresh plan and refresh the shared cache with it. */
function refreshPlan(state: IssueState): readonly PlanItem[] {
  const fresh = { at: Date.now(), plan: issuePlan(state.cwd) };
  state.cache = fresh;
  return fresh.plan;
}

/** The cached plan, re-shelling only when absent or past the TTL (so a poll never blocks per call). */
function servePlan(state: IssueState): readonly PlanItem[] {
  const { cache } = state;
  if (defined(cache) && Date.now() - cache.at <= ISSUE_CACHE_TTL) {
    return cache.plan;
  }
  return refreshPlan(state);
}

/** Apply an issue write via `gh` — the SAME `@vow/observability` calls the MCP's `close_issue` makes. */
function applyIssueWrite(cwd: string, write: IssueWrite): void {
  if (write.action === "close") {
    closeIssue(cwd, write.issue);
  } else {
    reopenIssue(cwd, write.issue);
  }
}

/**
 * Read + perform an issue write, then reply with the freshly re-shelled plan (busting the read cache, so the
 * studio sees the true derived status — closed -> done — at once). One seam for user (this) + agent (the MCP).
 */
async function serveIssueWrite(
  req: IncomingMessage,
  res: ServerResponse,
  state: IssueState,
): Promise<void> {
  try {
    const write = parseIssueWrite(await readBody(req));
    if (!defined(write)) {
      const error = "expected { action: 'close' | 'reopen', number }";
      writeReply(res, { body: { error }, status: STATUS.badRequest });
      return;
    }
    applyIssueWrite(state.cwd, write);
    writeReply(res, { body: refreshPlan(state), status: STATUS.ok });
  } catch (error) {
    writeReply(res, { body: { error: errorMessage(error) }, status: STATUS.serverError });
  }
}

/**
 * The dev issue API — `/__vow/issues`. GET serves the GitHub issue plan (`@vow/observability`'s `issuePlan`,
 * gh-direct, short-TTL cached so a poll never blocks); POST closes/reopens an issue (`{ action, number }`)
 * and re-shells the plan. The studio's table/board/roadmap read GET; their action buttons POST. A Worker
 * serves the same over the GitHub API in prod.
 */
export function issuesApi(cwd: string): Middleware {
  const state: IssueState = { cache: NONE, cwd };
  return (req, res, next) => {
    const method = req.method ?? "GET";
    if (method === "POST") {
      ignore(serveIssueWrite(req, res, state));
      return;
    }
    if (method !== "GET") {
      next();
      return;
    }
    writeReply(res, { body: servePlan(state), status: STATUS.ok });
  };
}
