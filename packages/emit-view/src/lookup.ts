import type { Maybe, ReadonlyVow } from "@vow/core";

/**
 * The read-only entity-lookup seam the view emitters accept — only `get(slug)`, no mutation. A plain
 * `Map<string, Vow>` (what the plugin builds) is structurally assignable to it, and — unlike a bare
 * `ReadonlyMap` parameter — every member is a read-only call, so the strict `prefer-readonly-parameter-types`
 * wall is satisfied without a cast.
 */
export interface EntityLookup {
  readonly get: (slug: string) => Maybe<ReadonlyVow>;
}
