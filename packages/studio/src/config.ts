/** A top-bar navigation link. */
export interface NavLink {
  readonly text: string;
  readonly link: string;
}

/** The site-level configuration a `docs/` consumer provides (its `studio.config.ts`). */
export interface StudioConfig {
  readonly title: string;
  readonly description?: string;
  /** Drop `.html` from URLs (default true). */
  readonly cleanUrls?: boolean;
  /** The top-bar nav (kept explicit — usually a handful of links). */
  readonly nav?: readonly NavLink[];
  /** The order of sidebar groups; pages join a group via their `group` frontmatter. */
  readonly sidebarGroups?: readonly string[];
}

/** Identity helper for a typed `studio.config.ts` (mirrors Vite's `defineConfig`). */
export function defineStudio(config: StudioConfig): StudioConfig {
  return config;
}
