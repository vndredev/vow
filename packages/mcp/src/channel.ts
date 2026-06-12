/* oxlint-disable prefer-readonly-parameter-types -- bridges the SDK Server, Object.entries tuples + a Promise */
/* oxlint-disable no-deprecated -- the channel protocol needs the low-level Server (its `notification` + the experimental capability); McpServer is the high-level tool API, the wrong tool here */
/* oxlint-disable consistent-type-specifier-style -- one @vow/observability import; a separate type import trips no-duplicate-imports */
import type { Notification, Request } from "@modelcontextprotocol/sdk/types.js";
import { type VowEvent, eventsPath, readEvents } from "@vow/observability";
import { mkdirSync, watch } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { once } from "node:events";
import path from "node:path";
import process from "node:process";

/**
 * The Claude Code Channels ADAPTER — one provider's way of consuming vow's provider-neutral event feed
 * (#497). It tails `.vow/events.jsonl` and pushes each new event into a running Claude Code session as a
 * `notifications/claude/channel` notification, so the connected orchestrator reacts to observed state
 * without being told. One-way: vow → the agent (it acts through vow's tools, no reply expected). The neutral
 * core stays the feed (the file + the SSE channel); this is a thin bridge, not a special path. Launched as a
 * channel via `.mcp.json` + `claude --dangerously-load-development-channels server:vow-channel`.
 */

/** The Claude Code channel push method — an event arrives in the session as `<channel source="vow" ...>`. */
const CHANNEL_METHOD = "notifications/claude/channel";

/** What Claude is told the channel is — so it reads each event as observed state and acts, never replies. */
const CHANNEL_INSTRUCTIONS =
  "vow's realtime-observability feed. Each <channel source=\"vow\"> event (a develop run starting/finishing, a phase, a merge) reports observed state. Read it and act on the backlog through vow's tools (dispatch, merge, file). One-way: no reply expected.";

/** The custom channel notification — the generic `NotificationT` the `Server` is parameterized with, so the
    custom method type-checks without a cast. */
interface ChannelNotification extends Notification {
  method: typeof CHANNEL_METHOD;
  params: { content: string; meta?: Record<string, string> };
}

/** The vow channel server — a low-level `Server` that can emit the channel notification. */
export type ChannelServer = Server<Request, ChannelNotification>;

/** The meta a channel event carries — identifier keys, string values (the Channels constraint), so the
    orchestrator can branch on the typed context. */
function channelMeta(event: Readonly<VowEvent>): Record<string, string> {
  const meta: Record<string, string> = { kind: event.kind };
  if (typeof event.issue === "number") {
    meta["issue"] = String(event.issue);
  }
  if (typeof event.pr === "number") {
    meta["pr"] = String(event.pr);
  }
  if (typeof event.phase === "string") {
    meta["phase"] = event.phase;
  }
  if (typeof event.detail === "string") {
    meta["detail"] = event.detail;
  }
  return meta;
}

/** The ` · `-joined context values of a meta map (everything but `kind`), or "" when there is none. */
function contextValues(meta: Readonly<Record<string, string>>): string {
  return Object.entries(meta)
    .filter(([key]) => key !== "kind")
    .map(([, value]) => value)
    .join(" · ");
}

/** A readable channel line for an event — `<kind>` plus its context, the human-facing `content`. */
function channelContent(event: Readonly<VowEvent>, meta: Readonly<Record<string, string>>): string {
  const context = contextValues(meta);
  if (context === "") {
    return event.kind;
  }
  return `${event.kind}  ${context}`;
}

/** The `{ content, meta }` an event pushes over the channel — content a readable line, meta the typed
    context. Pure, so the payload is unit-testable. */
export function channelEvent(event: Readonly<VowEvent>): {
  content: string;
  meta: Record<string, string>;
} {
  const meta = channelMeta(event);
  return { content: channelContent(event, meta), meta };
}

/** Build the channel server — the channel capability (what makes Claude Code treat it as a channel, not a
    tool server) + the instructions. */
export function buildChannelServer(): ChannelServer {
  return new Server<Request, ChannelNotification>(
    { name: "vow-channel", version: "0.0.0" },
    {
      capabilities: { experimental: { "claude/channel": {} } },
      instructions: CHANNEL_INSTRUCTIONS,
    },
  );
}

/** Ignore a promise that handles its own errors — keeps the watch callback sync without a floating promise. */
function ignore(promise: Promise<void>): boolean {
  return promise instanceof Promise;
}

/** Push each event into the connected session as a channel notification, in order. */
/* oxlint-disable no-await-in-loop -- the channel delivers events in order: one notification, then the next */
async function pushAll(server: ChannelServer, events: readonly VowEvent[]): Promise<void> {
  for (const event of events) {
    const { content, meta } = channelEvent(event);
    await server.notification({ method: CHANNEL_METHOD, params: { content, meta } });
  }
}
/* oxlint-enable no-await-in-loop */

/** Tail `.vow/events.jsonl` and push each NEW event (recorded after the channel connected) into the session.
    Skips the backlog so the orchestrator reacts to live state; a `pushed` counter makes a watch re-fire on
    an unrelated `.vow/` change a harmless no-op. Call after `server.connect`. */
export function watchAndPush(server: ChannelServer, cwd: string): void {
  let pushed = readEvents(cwd).length;
  mkdirSync(path.join(cwd, ".vow"), { recursive: true });
  watch(path.dirname(eventsPath(cwd)), () => {
    const events = readEvents(cwd);
    const fresh = events.slice(pushed);
    pushed = events.length;
    ignore(pushAll(server, fresh));
  });
}

/** Run the channel over stdio: build it, connect, tail the feed under `cwd`, and stay running until the
    session closes the pipe. The entry `vow channel` invokes this; @vow/cli never touches the SDK directly. */
export async function runChannel(cwd: string): Promise<void> {
  const server = buildChannelServer();
  await server.connect(new StdioServerTransport());
  watchAndPush(server, cwd);
  await once(process.stdin, "close");
}
