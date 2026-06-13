import type { Maybe, ReadonlyVow } from "@vow/core";
import { NONE } from "./none.ts";

/**
 * The `virtual:vow/tree` module — the vows exposed as a live ES module (observability).
 *
 * Vite resolves a virtual id to its NUL-prefixed internal form, then loads that form's source. The plugin
 * delegates both hooks here so the resolve/load seam stays one small, testable concern.
 */

/** The public id consumers import — `import { tree } from "virtual:vow/tree"`. */
export const VIRTUAL_TREE = "virtual:vow/tree";

/** The dev-overlay boot module — the injected `<script src>` loads it; Vite resolves its imports (which an
    inline `<script>`'s body is NOT — a bare specifier there reaches the browser raw). */
export const VIRTUAL_DEV = "virtual:vow/dev-overlay";

/** Vite's convention: a resolved virtual id is prefixed with NUL so no other plugin claims it. */
const NUL = "\0";

/** The vows as a self-contained ES-module source. */
export function vowTreeModule(vows: readonly ReadonlyVow[]): string {
  return `export const tree = ${JSON.stringify(vows)};\nexport default tree;`;
}

/** Resolve a vow virtual id (the tree, the dev overlay) to its NUL-prefixed form; ignore everything else. */
export function resolveVowId(id: string): Maybe<string> {
  if (id === VIRTUAL_TREE || id === VIRTUAL_DEV) {
    return NUL + id;
  }
  return NONE;
}

/** The dev-overlay boot module's source — import the bug-reporter client (a package export) + start it.
    Vite resolves the bare specifier because this is a real module in its graph. */
function devOverlayModule(): string {
  return 'import { setupBugReporter } from "@vow/vite-plugin/client/bug-reporter";\nsetupBugReporter();\n';
}

/** Load a vow virtual module (the vows as data, or the dev-overlay boot); ignore everything else. */
export function loadVowModule(id: string, vows: readonly ReadonlyVow[]): Maybe<string> {
  if (id === NUL + VIRTUAL_TREE) {
    return vowTreeModule(vows);
  }
  if (id === NUL + VIRTUAL_DEV) {
    return devOverlayModule();
  }
  return NONE;
}

/** A Vite HTML tag descriptor (the subset the dev overlay needs) — a `<script src>` pointing at the
    dev-overlay virtual module (which Vite resolves; an inline `<script>` body would not be). */
export interface OverlayTag {
  readonly tag: "script";
  readonly attrs: { readonly type: "module"; readonly src: string };
  readonly injectTo: "body";
}

/** The browser URL Vite serves a virtual module at — `/@id/` + the NUL prefix encoded as `__x00__`. */
const OVERLAY_SRC = "/@id/__x00__virtual:vow/dev-overlay";

/** The HTML tags injecting the in-app reporter overlay — the boot script in dev (`serve`), nothing in a
    build, so the overlay NEVER ships to production. Pure: the dev gate is a boolean, not a side effect. */
export function devOverlayTags(dev: boolean): OverlayTag[] {
  if (!dev) {
    return [];
  }
  return [{ attrs: { src: OVERLAY_SRC, type: "module" }, injectTo: "body", tag: "script" }];
}
