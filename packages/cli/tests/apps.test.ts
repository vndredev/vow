// @vitest-environment node
import {
  APPS,
  DEFAULT_DEV,
  HUB_APPS,
  appBySlug,
  isFullStop,
  repoRoot,
  resolveApps,
} from "../src/apps.ts";
import { expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import path from "node:path";

test("resolveApps: empty → the default dev set (studio + docs)", () => {
  expect(resolveApps([]).map((app) => app.slug)).toEqual(["studio", "docs"]);
  expect([...DEFAULT_DEV]).toEqual(["studio", "docs"]);
});

test("resolveApps: 'all' → every app, in registry order", () => {
  expect(resolveApps(["all"]).map((app) => app.slug)).toEqual(APPS.map((app) => app.slug));
});

test("resolveApps: 'all' anywhere wins; named apps de-duplicate", () => {
  expect(resolveApps(["docs", "all"]).map((app) => app.slug)).toEqual(APPS.map((app) => app.slug));
  expect(resolveApps(["docs", "docs", "studio"]).map((app) => app.slug)).toEqual([
    "docs",
    "studio",
  ]);
});

test("resolveApps: named apps, in the order given", () => {
  expect(resolveApps(["docs", "starter"]).map((app) => app.slug)).toEqual(["docs", "starter"]);
});

test("appBySlug: an unknown slug throws a clear error naming the valid apps", () => {
  expect(() => appBySlug("nope")).toThrow(/unknown app "nope"/u);
});

test("every app has a unique, fixed port", () => {
  const ports = APPS.map((app) => app.port);
  expect(new Set(ports).size).toBe(ports.length);
});

test("isFullStop: a bare command or 'all' is a full stop; a named app is not (#729)", () => {
  expect(isFullStop([])).toBe(true);
  expect(isFullStop(["all"])).toBe(true);
  expect(isFullStop(["docs"])).toBe(false);
  expect(isFullStop(["studio", "docs"])).toBe(false);
});

test("HUB_APPS carries the serve hub's own ports, distinct from the app ports (a full stop frees them)", () => {
  expect(HUB_APPS.map((hub) => hub.slug)).toEqual(["mcp", "events"]);
  const appPorts = new Set(APPS.map((app) => app.port));
  for (const hub of HUB_APPS) {
    expect(appPorts.has(hub.port)).toBe(false);
  }
});

test("repoRoot: resolves to the directory holding pnpm-workspace.yaml", () => {
  const root = repoRoot();
  expect(existsSync(path.join(root, "pnpm-workspace.yaml"))).toBe(true);
});

test("in-CLI throw messages are prefix-free (the top-level handler adds the single vow: prefix)", () => {
  // A throw that already carries the prefix would render doubled; throw sites here stay prefix-free.
  expect(() => appBySlug("nope")).not.toThrow(/^vow:/u);
});
