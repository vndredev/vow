/**
 * The store's low-level net helpers — shared by the row store and every read-only status concern. Held in
 * one leaf module (it imports nothing from the store) so the `hasApi` guard + `okJson` fetch each concern
 * needs lives once, and a concern file can own its own loader without pulling the whole index back in
 * (which would cycle).
 */

/** Whether the dev API is reachable — a browser with `fetch`. False under SSR / jsdom, where every loader
 *  short-circuits to a no-op so a non-DOM import stays safe. */
export const hasApi = "window" in globalThis && typeof fetch === "function";

/** One promise per in-flight dev-API call, held so it is never a floating promise; each removes itself on
 *  settle, so the set stays bounded by the number of concurrent calls. */
const inFlight = new Set<Promise<void>>();

/** Run an async task off the caller's path — without a floating promise or the `void` operator. The task
 *  owns its errors; its promise is held in `inFlight` and removes itself once it settles. */
export function detach(make: () => Promise<void>): void {
  let marker: Promise<void> = Promise.resolve();
  marker = (async (): Promise<void> => {
    try {
      await make();
    } catch {
      // The task owns its errors; detaching only runs it to completion off the caller's path.
    } finally {
      inFlight.delete(marker);
    }
  })();
  inFlight.add(marker);
}

/** GET `url` and parse its JSON, THROWING on a non-ok response so the caller's `catch` latches the failure
 *  (instead of a non-ok body being read as data) — the one place the `ok` check lives. */
export async function okJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status}`);
  }
  return res.json();
}
