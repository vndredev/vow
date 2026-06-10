import type { IconName } from "./types.ts";
import { lucide } from "./sets/lucide.ts";

export type { IconName } from "./types.ts";
export { lucide } from "./sets/lucide.ts";

/** The icon-library adapters — the swappable-set registry. Today only Lucide; Heroicons / Phosphor
 *  are added as further sets with the same keys (config-driven selection is a TODO, see activeSet). */
export const sets = { lucide } as const;

/** The active icon set — hardcoded to Lucide for now (config selection is not yet wired). */
export const activeSet: Record<IconName, string> = lucide;
