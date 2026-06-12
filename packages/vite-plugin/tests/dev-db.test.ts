// @vitest-environment node
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Maybe, defined } from "@vow/core/node";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type State, openDevDbGuarded } from "../src/index.ts";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { NONE } from "../src/none.ts";
import { env } from "node:process";
import path from "node:path";
import { tmpdir } from "node:os";

const freshState = (root: string): State => ({
  db: NONE,
  entities: [],
  genDir: path.join(root, ".generated"),
  lastWritten: [],
  root,
  vowDir: path.join(root, "app"),
  vows: [],
});

let dir = "";
let priorDbPath: Maybe<string> = NONE;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "vow-devdb-"));
  priorDbPath = env["VOW_DB_PATH"];
});

afterEach(() => {
  env["VOW_DB_PATH"] = priorDbPath;
  rmSync(dir, { force: true, recursive: true });
});

test("a corrupt dev DB is caught — the server keeps starting, the DB stays absent", () => {
  // Point the dev DB at garbage bytes: the SQLite open throws `file is not a database` on first exec.
  const garbage = path.join(dir, "data.db");
  writeFileSync(garbage, "this is not a sqlite file");
  env["VOW_DB_PATH"] = garbage;

  const state = freshState(dir);
  const logged: string[] = [];
  const record = (message: string): void => {
    logged.push(message);
  };

  expect(() => {
    openDevDbGuarded(state, record);
  }).not.toThrow();
  expect(defined(state.db)).toBe(false);
  expect(logged.some((line) => line.includes("dev DB open failed"))).toBe(true);
  expect(logged.some((line) => line.includes("corrupt"))).toBe(true);
});

test("a healthy dev DB opens — the DB is present after the guard", () => {
  env["VOW_DB_PATH"] = path.join(dir, "data.db");
  const state = freshState(dir);
  const logged: string[] = [];
  const record = (message: string): void => {
    logged.push(message);
  };

  openDevDbGuarded(state, record);
  expect(defined(state.db)).toBe(true);
  expect(logged).toEqual([]);
});
