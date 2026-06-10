// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type ReadonlyVow, defined } from "@vow/core";

/**
 * The vow-tree helpers shared across the plugin — flattening, the entity filter, and the option/page
 * shapes the generator and the plugin both speak. Every vow parameter is a `ReadonlyVow` (the strict-wall
 * `prefer-readonly-parameter-types` requirement); the read-only view is enough for traversal + projection.
 */

/** The plugin options — the visible source dir, the hidden output dir, inline vows, the shell title. */
export interface VowOptions {
  /** The visible folder-tree of `vow.md` — your app (default: "app"). */
  readonly dir?: string;
  /** The hidden directory for generated `.vue` — machine output (default: ".generated"). */
  readonly outDir?: string;
  /** Inline vows, bypassing `dir` — for tests. */
  readonly vows?: readonly ReadonlyVow[];
  /** The app name, shown as the shell brand (default: the shell's own fallback). */
  readonly title?: string;
}

/** A routed page (a non-root view or a form) — its slug plus the shell-sidebar nav config. */
export interface Page {
  readonly slug: string;
  readonly title: string;
  readonly icon?: string;
  readonly order?: number;
  readonly group?: string;
}

/** Flatten the tree into every vow, depth-first. */
export function allVows(vows: readonly ReadonlyVow[]): ReadonlyVow[] {
  return vows.flatMap((vow) => [vow, ...allVows(vow.children)]);
}

/** Is the vow an `emit entity`? */
export function isEntity(vow: ReadonlyVow): boolean {
  return vow.fulfills?.kind === "emit" && vow.fulfills.as === "entity";
}

/** The entity vows in the tree — the tables the DB schema + the data API are built from. */
export function entityVows(vows: readonly ReadonlyVow[]): ReadonlyVow[] {
  return allVows(vows).filter((vow) => isEntity(vow));
}

/** Add a single optional key to a page only when its value is present, so the key stays truly optional. */
function withOptional(page: Page, key: keyof Page, value: string | number | undefined): Page {
  if (defined(value)) {
    return { ...page, [key]: value };
  }
  return page;
}

/** A vow's `nav:` config projected to a routed `Page` — optional keys only when the vow declares them. */
export function navPage(vow: ReadonlyVow): Page {
  let page: Page = { slug: vow.slug, title: vow.nav?.label ?? vow.intent };
  page = withOptional(page, "icon", vow.nav?.icon);
  page = withOptional(page, "order", vow.nav?.order);
  page = withOptional(page, "group", vow.nav?.group);
  return page;
}
