// @vitest-environment node
// oxlint-disable prefer-readonly-parameter-types -- the middleware bridges the mutable Node req/res objects
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Server, createServer } from "node:http";
import { agentApi, issuesApi } from "../src/dev-api.ts";
import { expect, test } from "vite-plus/test";
import type { AddressInfo } from "node:net";
import type { IssueDetail } from "@vow/observability";
import { once } from "node:events";

/** A dev middleware — the shape `issuesApi`/`agentApi` return; resolved here so the test imports no type. */
type Middleware = ReturnType<typeof issuesApi>;

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

test("a malformed issue-write body returns 400, not 500 (a client error, not a server crash)", async () => {
  const server = await listening(issuesApi(process.cwd()));
  try {
    // `{}` is valid JSON but fails the issue-write shape — the distinct validation branch, never the catch.
    const { status, text } = await post(server, "{}");
    expect(status).toBe(BAD_REQUEST);
    expect(text).toContain("expected");
  } finally {
    server.close();
    await once(server, "close");
  }
});

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
