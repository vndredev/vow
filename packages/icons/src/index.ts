import type { IconName } from "./types.ts";
import { lucide } from "./sets/lucide.ts";

export type { IconName } from "./types.ts";
export { lucide } from "./sets/lucide.ts";

/** The icon-library adapters — the swappable-set registry. Today only Lucide; Heroicons / Phosphor
 *  are added as further sets with the same keys (config-driven selection is a TODO, see activeSet). */
export const sets = { lucide } as const;

/** The active icon set — hardcoded to Lucide for now (config selection is not yet wired). */
export const activeSet: Record<IconName, string> = lucide;

/** The valid semantic icon names — the list a generator checks an authored `icon:` against, so a typo is
 *  rejected loudly at generate time instead of rendering an empty SVG. Pure data (no Vue), read off the
 *  active set's own keys so it can never drift from the rendered glyphs. */
export const iconNames: readonly string[] = Object.keys(activeSet);
