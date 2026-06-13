// oxlint-disable prefer-readonly-parameter-types -- this module bridges the mutable Node http + db objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Db, assertNoReferrers, get, insert, list, remove, update } from "@vow/db";
import type { IncomingMessage, ServerResponse } from "node:http";
/* oxlint-disable consistent-type-specifier-style -- one mixed import per module; separate trips no-duplicate-imports */
import {
  type IssueDetail,
  type PlanItem,
  closeIssue,
  createEventTail,
  eventFrame,
  eventsPath,
  issueDetail,
  issuePlan,
  readEvents,
  readLoopStatus,
  reopenIssue,
} from "@vow/observability";
import { type Maybe, type ReadonlyVow, defined, isRecord } from "@vow/core";
/* oxlint-enable consistent-type-specifier-style */
import { existsSync, mkdirSync, watch } from "node:fs";
import { parseReport, reportIssue } from "./issue-report.ts";
import { NONE } from "./none.ts";
import { mutable } from "./mutable.ts";
import path from "node:path";
import { spawn } from "node:child_process";

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
  accepted: 202,
  badRequest: 400,
  conflict: 409,
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

/** A parsed data request — the resolved entity, the live entity set (for the referrer-scan delete guard),
 *  the method, the raw JSON body, and the optional record id. */
interface DataRequest {
  readonly db: Db;
  readonly entities: readonly ReadonlyVow[];
  readonly entity: ReadonlyVow;
  readonly method: string;
  readonly body: string;
}

/** A connect-style middleware: read the request, write the response, or pass to the next handler. */
export type Middleware = (
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

/** Route a DELETE to a reply — refuse (409) when the row is still referenced (the shared referrer-scan
 *  guard the MCP `removeRecord` also runs), else 204 on a removal / 404 when nothing matched. */
function deleteReply(request: DataRequest, id: string): Reply {
  const { db, entities, entity } = request;
  const target = mutable(entity);
  try {
    assertNoReferrers(db, entities, entity, id);
  } catch (error) {
    return { body: { error: errorMessage(error) }, status: STATUS.conflict };
  }
  return { status: deleteStatus(remove(db, target, id)) };
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
    return deleteReply(request, id);
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

/** The resolved route of a data request — the DB handle, the live entity set (for the delete guard), the
 *  target entity, and the optional record id. */
interface Route {
  readonly db: Db;
  readonly entities: readonly ReadonlyVow[];
  readonly entity: ReadonlyVow;
  readonly id: Maybe<string>;
}

/** Read the body, route the request, and write the reply — answers a 500 on any read/route failure. */
async function serveData(req: IncomingMessage, res: ServerResponse, route: Route): Promise<void> {
  const { db, entities, entity, id } = route;
  try {
    const body = await readBody(req);
    writeReply(res, dataReply({ body, db, entities, entity, method: req.method ?? "GET" }, id));
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
    const entities = getEntities();
    const entity = entities.find((candidate) => candidate.slug === slug);
    if (!defined(db) || !defined(entity)) {
      next();
      return;
    }
    ignore(serveData(req, res, { db, entities, entity, id }));
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

/** A parsed start-work signal — the human's one "agent, begin this issue" for a numbered issue. */
interface StartWork {
  readonly action: "start";
  readonly issue: number;
}

/** Parse + validate a start-work body (`{ action: "start", number }`) — absent when malformed, so a bad
 *  payload answers 400 (a client error), never dispatches a phantom run. */
function parseStartWork(body: string): Maybe<StartWork> {
  const { action, number } = parseBody(body);
  if (action === "start" && typeof number === "number") {
    return { action, issue: number };
  }
  return NONE;
}

/** Dispatch an agent session for an issue number — the one seam from the start-work signal to the agent
 *  run. It resolves the issue (number, title, body — the spec injected into the session) and starts the run,
 *  returning what it dispatched (so the reply echoes it). Injected so a test substitutes a fake that neither
 *  shells `gh` nor spawns a run; the default below does both. */
type Dispatch = (cwd: string, issue: number) => IssueDetail;

/**
 * Resolve the repo root from a starting directory — walk up to the directory holding `pnpm-workspace.yaml`,
 * or `NONE` when none is found above. The dev server's `cwd` is the Vite app root (e.g. `apps/studio`), but
 * the agent loop runs from (and records `.vow/`) at the REPO ROOT — so a surface reading the loop's output
 * (the event feed, the loop status) must resolve up to it, not read the app-local `.vow/`.
 */
export function repoRootOf(cwd: string): Maybe<string> {
  let dir = path.resolve(cwd);
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return NONE;
}

/**
 * Resolve the workspace-root `vow` binary from a starting directory — the repo root's `node_modules/.bin/vow`
 * (`repoRootOf` walks up to it). The dev server's `cwd` is the Vite app root (e.g. `apps/studio`), whose own
 * `node_modules/.bin` has NO `vow`; resolving the workspace bin is why the documented direct-bin start recipe
 * can dispatch a run at all. The bare name `"vow"` is the fallback when no workspace root is found above (a
 * launch where it IS on PATH).
 */
export function vowBin(cwd: string): string {
  const root = repoRootOf(cwd);
  if (defined(root)) {
    return path.join(root, "node_modules", ".bin", "vow");
  }
  return "vow";
}

/**
 * Spawn the agent run detached + unref'd so the dev server returns at once and the long-running session
 * outlives the request. stdio is ignored: the run logs to its own worktree, not the dev console. A spawn
 * failure (the bin is missing / not executable) is emitted asynchronously as an `error` event AFTER the
 * `202` already replied — so we MUST attach a listener: it LOGS and never throws, mirroring the CLI's
 * `spawnApp`. Without it the failure is an uncaught exception that takes the whole dev process down. The
 * spawned child is returned so a test can await its real `error` event.
 */
export function runAgentRun(command: string, cwd: string, issue: number): ReturnType<typeof spawn> {
  const child = spawn(command, ["agent", "run", String(issue)], {
    cwd,
    detached: true,
    stdio: "ignore",
  });
  child.on("error", (error: Readonly<Error>) => {
    process.stderr.write(`[vow] failed to start agent run for #${issue}: ${error.message}\n`);
  });
  child.unref();
  return child;
}

/**
 * Resolve an issue + fire the agent's live run for it — the channel from the studio signal to an agent
 * session. The issue's number/title/body is read via `gh` (the spec injected into the session, per the
 * channel), then the workspace-root `vow agent run <n>` is spawned (`runAgentRun`, detached + unref'd, with
 * an `error` listener so a spawn failure logs rather than crashing the dev server). The resolved detail is
 * returned so the reply echoes exactly what was dispatched.
 */
function dispatchAgent(cwd: string, issue: number): IssueDetail {
  const detail = issueDetail(cwd, issue);
  runAgentRun(vowBin(cwd), cwd, issue);
  return detail;
}

/** The start-work state — the cwd the agent runs in + the dispatch seam (the real spawn, or a test's). */
interface AgentState {
  readonly cwd: string;
  readonly dispatch: Dispatch;
}

/**
 * Read a start-work signal, dispatch the agent for the issue (resolving + injecting number/title/body), and
 * reply `202 Accepted` with the dispatched issue. The status is derived, never set: the signal means "agent,
 * begin this issue", and the run's resulting PR is what derives `doing`. One seam for the human (the studio
 * board action) — the agent half of the loop the close/reopen seam already serves for the user + the MCP.
 */
async function serveStartWork(
  req: IncomingMessage,
  res: ServerResponse,
  state: AgentState,
): Promise<void> {
  try {
    const signal = parseStartWork(await readBody(req));
    if (!defined(signal)) {
      const error = "expected { action: 'start', number }";
      writeReply(res, { body: { error }, status: STATUS.badRequest });
      return;
    }
    const issue = state.dispatch(state.cwd, signal.issue);
    writeReply(res, { body: { issue, started: true }, status: STATUS.accepted });
  } catch (error) {
    writeReply(res, { body: { error: errorMessage(error) }, status: STATUS.serverError });
  }
}

/** Whether a request's `Accept` header asks for the SSE wire (`text/event-stream`) — true for a browser
 *  `EventSource`, which always sends it, false for a plain JSON poll. Pure, so the content-negotiation is
 *  unit-testable without a live socket. */
export function wantsEventStream(accept: Maybe<string>): boolean {
  return typeof accept === "string" && accept.includes("text/event-stream");
}

/**
 * Stream the live feed to one `EventSource` subscriber over the SAME `/__vow/events` mount: the backlog
 * now, then each new event as `.vow/events.jsonl` grows, until the client disconnects. Mirrors the hub's
 * standalone SSE server (`@vow/observability`'s `eventsSseServer`) but inside the dev server, so the studio
 * gets true-push under `vow dev` (which never mounts that hub server). The incremental tail re-reads only
 * the appended delta on each watch fire (#595) and never re-emits a line — so the stream never duplicates.
 */
function streamEvents(cwd: string, res: ServerResponse): void {
  res.writeHead(STATUS.ok, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream",
  });
  const tail = createEventTail(cwd);
  const flush = (): void => {
    for (const event of tail()) {
      res.write(eventFrame(event));
    }
  };
  flush();
  mkdirSync(path.join(cwd, ".vow"), { recursive: true });
  const watcher = watch(path.dirname(eventsPath(cwd)), () => {
    flush();
  });
  res.on("close", () => {
    watcher.close();
  });
}

/**
 * The dev events API — `/__vow/events`. A browser `EventSource` (its `Accept: text/event-stream`) gets the
 * live SSE stream (`streamEvents`): the backlog, then each new event PUSHED instantly as the agent loop /
 * hub records it — so `run.started`/`run.phase`/`pr.merged` reach the trace in true realtime, not within a
 * 5s poll. A plain GET still serves the append-only feed as JSON (`readEvents`), the store's poll fallback
 * for when SSE is unavailable. No write seam either way — the feed is produced by operations, never the
 * browser.
 */
export function eventsApi(cwd: string): Middleware {
  return (req, res, next) => {
    if ((req.method ?? "GET") !== "GET") {
      next();
      return;
    }
    if (wantsEventStream(req.headers.accept)) {
      streamEvents(cwd, res);
      return;
    }
    writeReply(res, { body: readEvents(cwd), status: STATUS.ok });
  };
}

/**
 * The dev agent API — `/__vow/agent`. POST a start-work signal (`{ action: "start", number }`) and the dev
 * server dispatches an agent session for that issue (the project-local `vow agent run <n>`), injecting the
 * issue's number/title/body. The studio board's "Start work" action POSTs it — the human's one signal to
 * begin, the trigger half of the agent loop. `dispatch` is injectable so a test asserts the dispatch without
 * shelling `gh` or spawning a real run; the default resolves + shells the agent CLI detached.
 */
export function agentApi(cwd: string, dispatch: Dispatch = dispatchAgent): Middleware {
  const state: AgentState = { cwd, dispatch };
  return (req, res, next) => {
    if ((req.method ?? "GET") !== "POST") {
      next();
      return;
    }
    ignore(serveStartWork(req, res, state));
  };
}

/** Read a posted bug/feature report + file it as a phased, labelled vow issue, replying with its URL. */
async function serveIssue(req: IncomingMessage, res: ServerResponse, cwd: string): Promise<void> {
  try {
    const report = parseReport(await readBody(req));
    if (!defined(report)) {
      writeReply(res, { body: { error: "expected a kind + title" }, status: STATUS.badRequest });
      return;
    }
    writeReply(res, {
      body: { filed: true, url: reportIssue(cwd, report) },
      status: STATUS.created,
    });
  } catch (error) {
    writeReply(res, { body: { error: errorMessage(error) }, status: STATUS.serverError });
  }
}

/** `/__vow/issue` — the in-app reporter's POST target (the overlay's `client/bug-reporter.ts` posts here). */
export function issueApi(cwd: string): Middleware {
  return (req, res, next) => {
    if ((req.method ?? "GET") !== "POST") {
      next();
      return;
    }
    ignore(serveIssue(req, res, cwd));
  };
}

/**
 * The dev agent-loop API — `/__vow/agent-loop/status`. A plain GET serves the agent loop's live status
 * (`@vow/observability`'s `readLoopStatus`), read from the REPO-ROOT `.vow/loop-status.json` the loop process
 * (`vow serve --watch` / `vow agent auto`) records as it advances — the seam that makes the autonomous loop
 * observable, since the dev server can't read the loop process's memory. An absent/unread file is the
 * `running: false` idle default (no loop has run yet), so the studio always renders a well-formed status. The
 * `useAgentLoopStatus()` store hook polls this; the start/stop CONTROL half is a follow-up (#623). Read-only:
 * the status is produced by the loop, never the browser.
 */
export function loopStatusApi(cwd: string): Middleware {
  return (req, res, next) => {
    if ((req.method ?? "GET") !== "GET") {
      next();
      return;
    }
    writeReply(res, { body: readLoopStatus(cwd), status: STATUS.ok });
  };
}
