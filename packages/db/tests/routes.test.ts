import { VOW_API, dbPath } from "../src/routes.ts";
import { expect, test } from "vite-plus/test";

/**
 * The dev-API route shape is the ONE contract `@vow/store` (the client fetch) and `@vow/vite-plugin` (the
 * server mount) share. These pin the shape and the `dbPath` builder so a rename can't silently diverge the
 * two ends — the old duplicated literals let that pass every check while every fetch 404'd at runtime.
 */

test("VOW_API holds the dev-API mount points under /__vow", () => {
  expect(VOW_API.db).toBe("/__vow/db");
  expect(VOW_API.issues).toBe("/__vow/issues");
  expect(VOW_API.agent).toBe("/__vow/agent");
});

test("dbPath builds the collection path from VOW_API.db when no id is given", () => {
  expect(dbPath("task")).toBe("/__vow/db/task");
  // An empty id is the collection path too — no trailing segment.
  expect(dbPath("task", "")).toBe("/__vow/db/task");
});

test("dbPath builds the single-record path when an id is given", () => {
  expect(dbPath("task", "abc")).toBe("/__vow/db/task/abc");
});

test("every dbPath URL is prefixed by the VOW_API.db mount the server uses", () => {
  // The client builds its fetch URL with dbPath; the server mounts on VOW_API.db.
  // The prefix must match, else the request 404s — the very seam this contract removes.
  expect(dbPath("task").startsWith(VOW_API.db)).toBe(true);
  expect(dbPath("task", "abc").startsWith(VOW_API.db)).toBe(true);
});
