import type { UiNode } from "@vow/component";

/** A value that may be absent — the explicit name for `T | undefined`. */
export type Maybe<T> = T | undefined;

/**
 * A node assembled from its children, closed on the matching `_close` token. `build` receives the
 * accumulated child nodes and the inner fences' `[label]`s (collected by the walk only when
 * `collectsLabels` is set — for `::: code-group`). The frame itself is immutable; the walk owns the
 * mutable kids/labels accumulators, so frames pass around as readonly values.
 */
export interface Frame {
  readonly build: (kids: readonly UiNode[], labels: readonly string[]) => UiNode;
  readonly collectsLabels?: boolean;
}

/** One "on this page" entry — a heading's level (2|3), text, and slug id. */
export interface TocEntry {
  readonly level: number;
  readonly slug: string;
  readonly text: string;
}

/** Read a `<<< <path>` snippet's content (relative to the source file); absent = not found. */
export type ResolveSnippet = (path: string) => Maybe<string>;

/**
 * A read-only view of the fields the renderer reads off a markdown-it token. markdown-it's `Token` is an
 * external mutable class; the parser maps each token to this readonly shape (with `null` normalized to
 * absence), so the renderer's pure step functions take only readonly token parameters.
 */
export interface Tok {
  readonly attrGet: (name: string) => Maybe<string>;
  readonly children: readonly Tok[];
  readonly content: string;
  readonly hidden: boolean;
  readonly info: string;
  readonly tag: string;
  readonly type: string;
}

/** One token's contribution to the walk — a pure value the applier turns into a stack mutation. */
export type Step =
  | { readonly kind: "close" }
  | { readonly kind: "fence"; readonly label: string; readonly node: UiNode }
  | { readonly kind: "noop" }
  | { readonly kind: "open"; readonly frame: Frame }
  | { readonly kind: "push"; readonly nodes: readonly UiNode[] };

/** A walk turns each token into a pure `Step`; the applier owns all stack/kids/label mutation. */
export type StepFn = (token: Tok) => Step;
