/**
 * The agent orchestrator — fan out many issues across concurrent runs, each in its own worktree, capped so
 * one machine isn't swamped. Provider-neutral (it runs whatever `worker` it is handed) and built on plain
 * Promises, not a Claude-specific workflow engine: vow owns its own orchestration.
 */

/** Run `worker` over `items` with at most `limit` in flight at once, preserving input order in the result.
 *  Pure over the injected `worker` — the concurrency primitive the agent fan-out is built on. A shared
 *  iterator feeds `width` lanes, so each lane pulls the next item as it frees up (no fixed batches). */
export async function mapLimit<Item, Result>(
  items: readonly Item[],
  limit: number,
  worker: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = [];
  const queue = items.entries();
  const lane = async (): Promise<void> => {
    for (const [index, item] of queue) {
      // oxlint-disable-next-line no-await-in-loop -- sequential within a lane IS the design; the cap is across lanes
      results[index] = await worker(item);
    }
  };
  const width = Math.max(1, Math.min(limit, items.length));
  const lanes: Promise<void>[] = [];
  for (let started = 0; started < width; started += 1) {
    lanes.push(lane());
  }
  await Promise.all(lanes);
  return results;
}
