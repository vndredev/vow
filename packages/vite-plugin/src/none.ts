import type { Maybe } from "@vow/core";

/**
 * The single absence value for a `Maybe<T>`.
 *
 * The max lint wall forbids writing the `undefined` identifier (`no-undefined`), so absence is read off an
 * empty object's optional slot — the one place a `Maybe` `undefined` originates. Return `NONE` wherever a
 * function must yield "no value" (mirrors `@vow/observability`'s same seam).
 */
const ABSENT: { readonly slot?: never } = {};

/** The single absence value for a `Maybe<T>`. */
export const NONE: Maybe<never> = ABSENT.slot;
