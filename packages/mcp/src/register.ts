import type { Names } from "./types.ts";
import { summaryOf } from "./tools.ts";

/**
 * The name recorder — the server <-> catalogue drift guard. Each register module calls
 * `server.registerTool` directly (the non-deprecated API) with a concrete zod shape: that's what lets
 * the handler's parsed args be typed and read-only without a cast (the generic form defers the SDK's
 * callback conditional, so it cannot be wrapped). Each registration routes its config through
 * `at(name)`, which records the name once and returns `{ name, description }` from the catalogue
 * (`summaryOf`). `compose.ts` collects the names; the catalogue test compares them to `TOOL_DOCS`.
 */
export function names(): Names {
  const all: string[] = [];
  return {
    all,
    at: (name) => {
      all.push(name);
      return { description: summaryOf(name), name };
    },
  };
}
