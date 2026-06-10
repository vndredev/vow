// @vitest-environment node
import { APPS, DEFAULT_DEV, appBySlug, resolveApps } from "../src/apps.ts";
import { expect, test } from "vite-plus/test";

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
