import type { IconName } from "../types.ts";

/**
 * The Lucide adapter — the inner SVG of each semantic icon (viewBox 0 0 24 24, stroke-based, drawn
 * with the shared `<svg>` wrapper in Icon.vue). Lucide is ISC-licensed. A second library (Heroicons,
 * Phosphor) is just another file with the same keys.
 */
export const lucide: Record<IconName, string> = {
  menu: `<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>`,
  search: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`,
  moon: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`,
  "chevron-down": `<path d="m6 9 6 6 6-6"/>`,
  "chevron-right": `<path d="m9 18 6-6-6-6"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
};
