import { existsSync, readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { isRecord } from "@vow/core";
import path from "node:path";
import { undocumentedPackages } from "../src/index.ts";

const VOW_PREFIX = "@vow/";

/** The `@vow/*` name (prefix stripped) a package.json declares, as a 0-or-1 list. */
function vowNameIn(json: string): string[] {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) {
    return [];
  }
  const { name } = parsed;
  if (typeof name === "string" && name.startsWith(VOW_PREFIX)) {
    return [name.slice(VOW_PREFIX.length)];
  }
  return [];
}

/** Every `@vow/*` package name (prefix stripped) declared under packages/. */
function packageNames(): string[] {
  const dir = path.resolve(import.meta.dirname, "..", "..");
  return readdirSync(dir)
    .map((name) => path.join(dir, name, "package.json"))
    .filter((file) => existsSync(file))
    .flatMap((file) => vowNameIn(readFileSync(file, "utf8")));
}

const PACKAGES_DOC = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "docs",
  "guide",
  "packages.md",
);

test("every @vow package is documented in the packages directory page", () => {
  expect(undocumentedPackages(packageNames(), readFileSync(PACKAGES_DOC, "utf8"))).toEqual([]);
});

test("the gate catches an undocumented package", () => {
  expect(undocumentedPackages(["ghost"], "no mention of it here")).toEqual(["ghost"]);
});
