/**
 * Shared runtime guards for `@vow/store`. The store validates every value parsed from the dev API at
 * runtime (not a blind cast), so a malformed response degrades to clean, typed data.
 */

/** Is `value` a non-null object (so its keys can be read)? */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Read a value as a string, falling back to `fallback` when it is not one. */
export function asString(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  return fallback;
}

/** Read a value as a finite number, falling back to `0` when it is not one. */
export function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  return 0;
}

/** Keep only the string members of a parsed value, or an empty array when it is not an array at all. */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const list: readonly unknown[] = value;
  return list.filter((entry: unknown): entry is string => typeof entry === "string");
}
