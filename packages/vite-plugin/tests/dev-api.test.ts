// @vitest-environment node
// oxlint-disable prefer-readonly-parameter-types -- the middleware bridges the mutable Node req/res objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Db, insert, migrate, openDb } from "@vow/db";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Server, createServer } from "node:http";
import { agentApi, dataApi, runAgentRun, vowBin } from "../src/dev-api.ts";
import { expect, test } from "vite-plus/test";
import type { AddressInfo } from "node:net";
import type { IssueDetail } from "@vow/observability";
import type { ReadonlyVow } from "@vow/core";
import { existsSync } from "node:fs";
import { once } from "node:events";
import path from "node:path";

/** A dev middleware — the shape `agentApi`/`dataApi` return; resolved here so the test imports no type. */
type Middleware = ReturnType<typeof agentApi>;

const BAD_REQUEST = 400;
const ACCEPTED = 202;
const ISSUE = 42;

/** The bound loopback port from a listening server's address (the OS picks it via `listen(0)`). */
function portOf(address: AddressInfo | string | null): number {
  if (address !== null && typeof address !== "string") {
    return address.port;
  }
  return 0;
}

/** A throwaway loopback server running a real dev middleware, listening on an OS-picked port — the `next`
 *  fallback is a 400 so a request the middleware passes through is observable, not a hang. */
async function listening(api: Middleware): Promise<Server> {
  const server = createServer((req, res) => {
    api(req, res, () => {
      res.statusCode = BAD_REQUEST;
      res.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

/** POST `body` to the loopback `server` and return the response + its text. */
async function post(server: Server, body: string): Promise<{ status: number; text: string }> {
  const response = await fetch(`http://127.0.0.1:${portOf(server.address())}`, {
    body,
    method: "POST",
  });
  return { status: response.status, text: await response.text() };
}

/** A recording dispatch seam (no `gh` shell, no spawned run) + the list it records each call into — so a
 *  test asserts the channel (signal -> dispatch the issue's number/title/body) hermetically. */
function recordingDispatch(): {
  calls: { cwd: string; issue: number }[];
  dispatch: (cwd: string, issue: number) => IssueDetail;
} {
  const calls: { cwd: string; issue: number }[] = [];
  return {
    calls,
    dispatch: (cwd, issue): IssueDetail => {
      calls.push({ cwd, issue });
      return { body: "the spec", number: issue, title: "an issue" };
    },
  };
}

test("a start-work signal dispatches the agent for the issue and replies 202 with the dispatched issue", async () => {
  const { calls, dispatch } = recordingDispatch();
  const server = await listening(agentApi("/some/where", dispatch));
  try {
    const { status, text } = await post(server, JSON.stringify({ action: "start", number: ISSUE }));
    expect(status).toBe(ACCEPTED);
    expect(calls).toEqual([{ cwd: "/some/where", issue: ISSUE }]);
    expect(JSON.parse(text)).toEqual({
      issue: { body: "the spec", number: ISSUE, title: "an issue" },
      started: true,
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("a malformed start-work body returns 400 and never dispatches a phantom run", async () => {
  const { calls, dispatch } = recordingDispatch();
  const server = await listening(agentApi(process.cwd(), dispatch));
  try {
    // `{}` is valid JSON but fails the start-work shape — the validation branch, never a dispatch.
    const { status, text } = await post(server, "{}");
    expect(status).toBe(BAD_REQUEST);
    expect(text).toContain("expected");
    expect(calls).toEqual([]);
  } finally {
    server.close();
    await once(server, "close");
  }
});

const CONFLICT = 409;
const NO_CONTENT = 204;

/** A minimal entity vow — only the parts `@vow/db` reads (slug, fields). */
function entity(slug: string, fields: ReadonlyVow["fields"]): ReadonlyVow {
  return { children: [], fields, id: `vow_${slug}`, intent: slug, proof: [], slug };
}

const userVow = entity("user", [{ name: "name", required: true, type: "text" }]);
const taskVow = entity("task", [
  { name: "title", required: true, type: "text" },
  { name: "owner", ref: "user", required: false, type: "reference" },
]);

/** DELETE `path` on the loopback `server` and return the response + its text. */
async function del(server: Server, route: string): Promise<{ status: number; text: string }> {
  const response = await fetch(`http://127.0.0.1:${portOf(server.address())}${route}`, {
    method: "DELETE",
  });
  return { status: response.status, text: await response.text() };
}

/** A `:memory:` DB seeded with Alice (user) + a task whose `owner` references her — the dangling-ref shape. */
function seededDb(): { db: Db; aliceId: string } {
  const db: Db = openDb(":memory:");
  migrate(db, [userVow, taskVow]);
  const alice = insert(db, userVow, { name: "Alice" });
  insert(db, taskVow, { owner: String(alice["id"]), title: "Ship it" });
  return { aliceId: String(alice["id"]), db };
}

/** A `dataApi` middleware over a fixed DB + the user/task entity set. */
function dataMiddleware(db: Db): Middleware {
  const entities = [userVow, taskVow];
  return dataApi(
    () => db,
    () => entities,
  );
}

test("the dev DELETE refuses (409) to delete a row another entity still references", async () => {
  const { db, aliceId } = seededDb();
  const server = await listening(dataMiddleware(db));
  try {
    // The generated UI's delete hits the same path the MCP `remove_record` does — both run the guard.
    const refused = await del(server, `/user/${aliceId}`);
    expect(refused.status).toBe(CONFLICT);
    expect(refused.text).toContain("still referenced by task.owner");
    // The unreferenced task itself deletes (204) — the guard only blocks a referenced row.
    const free = await del(server, `/task/${String(insert(db, taskVow, { title: "Free" })["id"])}`);
    expect(free.status).toBe(NO_CONTENT);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("vowBin resolves the workspace-root bin, not the cwd's app-local node_modules", () => {
  // The dev server's cwd is the Vite app root (apps/<slug>); the walk up finds the workspace root above it.
  const appCwd = path.join(process.cwd(), "apps", "studio");
  const resolved = vowBin(appCwd);
  expect(resolved.endsWith(path.join("node_modules", ".bin", "vow"))).toBe(true);
  // Resolved against the WORKSPACE root, never the app-local node_modules (which has no vow bin).
  expect(resolved.includes(path.join("apps", "studio"))).toBe(false);
  expect(existsSync(resolved)).toBe(true);
});

test("a spawn failure on the real spawn line LOGS and never crashes the dev process", async () => {
  /* Exercise the real `runAgentRun` spawn line (not the recording fake) with a bin that ENOENTs — the
     `error` event fires asynchronously after dispatch; the real listener must log it, never throw it. The
     returned child lets us await that real event; the process surviving the await is the proof it never
     crashed (an unhandled `error` event would be an uncaught exception). `stderr.write` is captured to
     assert the listener logged the issue, then restored. */
  const logged: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    logged.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    const child = runAgentRun(path.join(process.cwd(), "no-such-vow-bin"), process.cwd(), ISSUE);
    await once(child, "error");
  } finally {
    process.stderr.write = original;
  }
  expect(logged.some((line) => line.includes(`#${ISSUE}`))).toBe(true);
});
