import { reactive } from "vue";

/**
 * @vow/store — a shared, reactive in-memory collection per entity slug. Every generated view that lists
 * the same entity shares ONE array, so a `reference` field can read another entity's items (the relation
 * dropdown). This is the memory data adapter; a Cloudflare D1 backend swaps the storage behind the same
 * `useCollection` seam, leaving the generated views unchanged.
 */
const collections = new Map<string, unknown[]>();

export interface Collection<T> {
  /** The shared reactive array of items for this slug. */
  readonly items: T[];
  /** Append an item to the collection. */
  append(item: T): void;
  /** Remove the item at an index. */
  removeAt(index: number): void;
}

/** The shared reactive collection for an entity slug — same array for every caller of the same slug. */
export function useCollection<T>(slug: string): Collection<T> {
  let items = collections.get(slug) as T[] | undefined;
  if (!items) {
    items = reactive<T[]>([]) as T[];
    collections.set(slug, items);
  }
  return {
    items,
    append: (item) => void items.push(item),
    removeAt: (index) => void items.splice(index, 1),
  };
}
