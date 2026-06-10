import type { ReadonlyVow } from "./types.ts";
import { pascalCase } from "@vow/component";

/**
 * The PascalCase component names the view emitters share — one place, so the name a `## view` references
 * (in `map-node.ts`) and the name the emitter writes always agree.
 */

/** The PascalCase component name for an entity's list view (`task` → `Task`). */
export function viewComponentName(entity: ReadonlyVow): string {
  return pascalCase(entity.slug);
}

/** The component name for an entity's counts-by-field stats (`task`,`status` → `TaskStatusStats`). */
export function statsComponentName(of: string, by: string): string {
  return `${pascalCase(of)}${pascalCase(by)}Stats`;
}

/** The component name for an entity's card grid (`task` → `TaskCards`). */
export function cardsComponentName(of: string): string {
  return `${pascalCase(of)}Cards`;
}

/** The component name for an entity's kanban board (`task`,`status` → `TaskStatusBoard`). */
export function boardComponentName(of: string, by: string): string {
  return `${pascalCase(of)}${pascalCase(by)}Board`;
}
