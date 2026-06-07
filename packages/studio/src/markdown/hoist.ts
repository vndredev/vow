import { mapOutsideFences } from "./fences.ts";

/** Top-level `<script …>…</script>` / `<style …>…</style>` an author wrote in a page's markdown. */
const BLOCK = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

export interface Hoisted {
  /** The markdown body with the script/style blocks removed. */
  readonly body: string;
  /** The extracted blocks, verbatim, to place at the SFC top level. */
  readonly blocks: readonly string[];
}

/**
 * Pull an author's top-level `<script>` / `<style>` blocks out of the markdown body (never from inside
 * code fences) so the compiler can hoist them to the SFC top level — markdown's body becomes the
 * `<template>`, and these become the SFC's real script/style.
 */
export function hoistBlocks(src: string): Hoisted {
  const blocks: string[] = [];
  const body = mapOutsideFences(src, (text) =>
    text.replace(BLOCK, (match) => {
      blocks.push(match.trim());
      return "";
    }),
  );
  return { body, blocks };
}
