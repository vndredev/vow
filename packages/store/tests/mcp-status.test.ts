import { MCP_STATUS_DISCONNECTED, parseMcpStatus } from "../src/mcp-status.ts";
import { expect, test } from "vite-plus/test";

/**
 * The store's MCP-status parser — it validates the `/__vow/mcp/status` JSON wire at runtime (never a
 * blind cast), so a malformed response degrades to the clean disconnected default. The three fields are:
 * `connected` (a boolean), `toolCount` (a non-negative integer), and the optional `lastEvent` (kind + ts).
 */

const TOOL_COUNT = 12;

test("parseMcpStatus lifts a well-formed status without lastEvent", () => {
  const status = parseMcpStatus({ connected: true, toolCount: TOOL_COUNT });
  expect(status).toEqual({ connected: true, toolCount: TOOL_COUNT });
  expect(status).not.toHaveProperty("lastEvent");
});

test("parseMcpStatus lifts a well-formed status with lastEvent", () => {
  const status = parseMcpStatus({
    connected: true,
    lastEvent: { kind: "run.started", ts: "2026-06-14T10:00:00.000Z" },
    toolCount: TOOL_COUNT,
  });
  expect(status).toEqual({
    connected: true,
    lastEvent: { kind: "run.started", ts: "2026-06-14T10:00:00.000Z" },
    toolCount: TOOL_COUNT,
  });
});

test("parseMcpStatus validates every field — a malformed payload degrades to the disconnected default", () => {
  expect(parseMcpStatus({ connected: "yes", toolCount: -1 })).toEqual({
    connected: false,
    toolCount: 0,
  });
});

test("parseMcpStatus omits lastEvent when its fields are not strings", () => {
  const status = parseMcpStatus({
    connected: true,
    lastEvent: { kind: 42, ts: false },
    toolCount: TOOL_COUNT,
  });
  expect(status).not.toHaveProperty("lastEvent");
});

test("parseMcpStatus omits lastEvent when it is not an object", () => {
  const status = parseMcpStatus({ connected: false, lastEvent: "run.started", toolCount: 0 });
  expect(status).not.toHaveProperty("lastEvent");
});

test("parseMcpStatus is the disconnected default for a non-object wire (number / array / string)", () => {
  expect(parseMcpStatus(TOOL_COUNT)).toEqual(MCP_STATUS_DISCONNECTED);
  expect(parseMcpStatus([TOOL_COUNT])).toEqual(MCP_STATUS_DISCONNECTED);
  expect(parseMcpStatus("connected")).toEqual(MCP_STATUS_DISCONNECTED);
});
