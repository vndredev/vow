// @vitest-environment node
/* oxlint-disable prefer-readonly-parameter-types -- the helpers bridge the mutable node:http Server */
import { EVENTS_PATH, eventFrame, eventsSseServer } from "../src/events-sse.ts";
import { expect, test } from "vite-plus/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { recordEvent } from "../src/events.ts";

const ISSUE = 42;
const NOT_FOUND = 404;

test("eventFrame is the SSE wire form `data: <json>` — provider-neutral, any client reads it (#497)", () => {
  expect(eventFrame({ issue: ISSUE, kind: "run.started", ts: "t" })).toBe(
    `data: ${JSON.stringify({ issue: ISSUE, kind: "run.started", ts: "t" })}\n\n`,
  );
});

/** The bound loopback port of a listening server. */
function portOf(address: Readonly<AddressInfo> | string | null): number {
  if (address !== null && typeof address !== "string") {
    return address.port;
  }
  return 0;
}

/** A fresh event-channel server in a temp `cwd`, awaited to listening. */
async function bootSse(cwd: string): Promise<Server> {
  const server = eventsSseServer(cwd, 0);
  await once(server, "listening");
  return server;
}

/** Close a server, awaiting its `close` so the test ends cleanly. */
async function closeServer(server: Server): Promise<void> {
  const closed = once(server, "close");
  server.close();
  await closed;
}

/** GET `url` and decode the first streamed chunk (the SSE backlog), then leave the stream to be aborted. */
async function firstChunk(url: string, abort: Readonly<AbortController>): Promise<string> {
  const res = await fetch(url, { signal: abort.signal });
  const chunk = await res.body?.getReader().read();
  return new TextDecoder().decode(chunk?.value);
}

test("eventsSseServer streams the recorded backlog to a subscriber over /events (#497 element 2)", async () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "vow-sse-"));
  recordEvent(cwd, "run.started", { issue: ISSUE });
  const server = await bootSse(cwd);
  const abort = new AbortController();
  try {
    const text = await firstChunk(
      `http://localhost:${portOf(server.address())}${EVENTS_PATH}`,
      abort,
    );
    expect(text).toContain("data: ");
    expect(text).toContain(`"issue":${ISSUE}`);
  } finally {
    abort.abort();
    await closeServer(server);
  }
});

test("eventsSseServer answers a non-/events path with 404", async () => {
  const server = await bootSse(mkdtempSync(path.join(os.tmpdir(), "vow-sse-404-")));
  try {
    const res = await fetch(`http://localhost:${portOf(server.address())}/other`);
    expect(res.status).toBe(NOT_FOUND);
  } finally {
    await closeServer(server);
  }
});
