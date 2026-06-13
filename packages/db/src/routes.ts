/**
 * The dev-API route shape — ONE source for the URL contract the data layer's two ends share. The browser
 * store (`@vow/store`) fetches these paths; the dev server (`@vow/vite-plugin`) mounts them. Holding the
 * shape here, in a node-free module, means a rename moves both ends at once — the seam can no longer lie
 * (the old duplicated literals let a rename pass every check while every fetch 404'd at runtime).
 *
 * Node-free on purpose: the store imports it in the browser, so this file must not pull `node:*` (unlike
 * the rest of `@vow/db`). It is exposed under the `@vow/db/routes` subpath, away from the node barrel.
 */

/** The dev-API mount points, under `/__vow`. `db` is the data layer (`/__vow/db/<slug>[/<id>]`); `issues`
 *  is the gh-direct issue plan (`/__vow/issues`); `agent` is the start-work signal that dispatches an agent
 *  session for an issue (`/__vow/agent`); `events` is the append-only event feed (`/__vow/events`). Both
 *  the client fetch and the server mount read these. */
export const VOW_API = {
  agent: "/__vow/agent",
  db: "/__vow/db",
  events: "/__vow/events",
  issue: "/__vow/issue",
  issues: "/__vow/issues",
} as const;

/** The data-layer path for a slug, optionally a single record — `/__vow/db/<slug>` or
 *  `/__vow/db/<slug>/<id>`. The store builds its fetch URL with this; the server's `parsePath` reverses it.
 *  An absent or empty `id` is the collection path (no trailing segment). */
export function dbPath(slug: string, id?: string): string {
  if (typeof id === "string" && id !== "") {
    return `${VOW_API.db}/${slug}/${id}`;
  }
  return `${VOW_API.db}/${slug}`;
}
