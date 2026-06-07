import { lucide } from "./sets/lucide.ts";
import type { IconName } from "./types.ts";

export type { IconName } from "./types.ts";
export { lucide } from "./sets/lucide.ts";

/** The icon-library adapters. Pick one by config — the same swappable pattern as the framework
 *  adapters. Today only Lucide; Heroicons / Phosphor are added as further sets with the same keys. */
export const sets = { lucide } as const;
export type IconSet = keyof typeof sets;

/** The active icon set (config-selected later; defaults to Lucide). */
export const activeSet: Record<IconName, string> = lucide;
