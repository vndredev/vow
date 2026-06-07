/**
 * @vow/studio — vow's view system. It renders markdown pages AND (later) the vow forest into a themed,
 * navigable site on Vite+, replacing VitePress. Living docs today; a planning/board view over the same
 * forest tomorrow — one source, many views.
 *
 * Built phase by phase (see the plan). P0 scaffolds the package and spikes the Vite+ SSR render path
 * (tests/spike.ssr.test.ts). The markdown -> Vue pipeline, file-based routing, the app shell, and the
 * SSG build land in later phases.
 */

/** The site-level configuration a `docs/` consumer provides. Grows field-by-field as phases earn it. */
export interface StudioConfig {
  readonly title: string;
  readonly description?: string;
}
