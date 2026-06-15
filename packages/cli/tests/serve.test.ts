// @vitest-environment node
import { appNames, resetsIdleOnStartup, serveBanner, watchDecision } from "../src/serve.ts";
import { expect, test } from "vite-plus/test";

const STUDIO_PORT = 5173;
const DOCS_PORT = 5174;
const MCP_PORT = 5176;
const EVENTS_PORT = 5177;

test("serveBanner names the local hub and lists each surface's URL + the MCP + event channels (#491, #497)", () => {
  const banner = serveBanner(
    [
      { port: STUDIO_PORT, slug: "studio" },
      { port: DOCS_PORT, slug: "docs" },
    ],
    { events: EVENTS_PORT, mcp: MCP_PORT },
    "off",
  );
  expect(banner).toContain("vow serve — your local hub");
  expect(banner).toContain("the /__vow control API");
  expect(banner).toContain(`http://localhost:${STUDIO_PORT}/`);
  expect(banner).toContain(`http://localhost:${DOCS_PORT}/`);
  expect(banner).toContain(`http://localhost:${MCP_PORT}/mcp`);
  expect(banner).toContain("agent channel");
  expect(banner).toContain(`http://localhost:${EVENTS_PORT}/events`);
  expect(banner).toContain("observability");
});

test("serveBanner's watch line reflects the watch state (#490 element 3)", () => {
  const ports = { events: EVENTS_PORT, mcp: MCP_PORT };
  expect(serveBanner([], ports, "run")).toContain("watch loop ON");
  expect(serveBanner([], ports, "refuse")).toContain("--watch ignored");
  expect(serveBanner([], ports, "off")).toContain("watch loop off");
});

test("watchDecision: --watch + opt-in runs, --watch alone refuses, no --watch is off (#490, #486)", () => {
  expect(watchDecision(true, true)).toBe("run");
  expect(watchDecision(true, false)).toBe("refuse");
  expect(watchDecision(false, true)).toBe("off");
  expect(watchDecision(false, false)).toBe("off");
});

test("resetsIdleOnStartup clears a stale loop status when the watch loop is off, never when it runs (#727)", () => {
  // The loop owns its status while running; off/refused, bring-up resets idle so no phantom round shows.
  expect(resetsIdleOnStartup("run")).toBe(false);
  expect(resetsIdleOnStartup("refuse")).toBe(true);
  expect(resetsIdleOnStartup("off")).toBe(true);
});

test("appNames keeps the positional app slugs and drops the --flags", () => {
  expect(appNames(["studio", "--watch", "docs", "--yes"])).toEqual(["studio", "docs"]);
  expect(appNames(["--watch"])).toEqual([]);
  expect(appNames([])).toEqual([]);
});
