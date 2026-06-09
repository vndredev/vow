// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { appBySlug, APPS, DEFAULT_DEV, resolveApps } from "../src/apps.ts";

test("resolveApps: empty → the default dev set (studio + docs)", () => {
  expect(resolveApps([]).map((a) => a.slug)).toEqual(["studio", "docs"]);
  expect([...DEFAULT_DEV]).toEqual(["studio", "docs"]);
});

test("resolveApps: 'all' → every app, in registry order", () => {
  expect(resolveApps(["all"]).map((a) => a.slug)).toEqual(APPS.map((a) => a.slug));
});

test("resolveApps: named apps, in the order given", () => {
  expect(resolveApps(["docs", "starter"]).map((a) => a.slug)).toEqual(["docs", "starter"]);
});

test("appBySlug: an unknown slug throws a clear error naming the valid apps", () => {
  expect(() => appBySlug("nope")).toThrow(/unknown app "nope"/);
});

test("every app has a unique, fixed port", () => {
  const ports = APPS.map((a) => a.port);
  expect(new Set(ports).size).toBe(ports.length);
});
