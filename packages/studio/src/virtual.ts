import { join } from "node:path";
import type { StudioConfig } from "./config.ts";
import type { Route } from "./routes.ts";
import type { SidebarGroup } from "./sidebar.ts";

/** The virtual modules the client app imports — the route table, the sidebar tree, and the config. */
export const VIRTUAL = {
  routes: "virtual:vow-studio/routes",
  sidebar: "virtual:vow-studio/sidebar",
  config: "virtual:vow-studio/config",
} as const;

const ids = Object.values(VIRTUAL) as readonly string[];

/** Resolve a `virtual:vow-studio/*` id to its internal (NUL-prefixed) form, or undefined. */
export function resolveVirtual(id: string): string | undefined {
  return ids.includes(id) ? `\0${id}` : undefined;
}

export interface VirtualData {
  readonly routes: readonly Route[];
  readonly sidebar: readonly SidebarGroup[];
  readonly config: StudioConfig;
  /** Absolute path to the content root, to build the route component imports. */
  readonly contentDir: string;
}

/** Load a resolved virtual module to its ES-module source, or undefined if the id isn't ours. */
export function loadVirtual(resolvedId: string, data: VirtualData): string | undefined {
  if (resolvedId === `\0${VIRTUAL.routes}`) {
    const entries = data.routes
      .map((route) => {
        const file = JSON.stringify(join(data.contentDir, route.file));
        return `  { path: ${JSON.stringify(route.path)}, component: () => import(${file}) }`;
      })
      .join(",\n");
    return `export const routes = [\n${entries}\n];\n`;
  }
  if (resolvedId === `\0${VIRTUAL.sidebar}`) {
    return `export const sidebar = ${JSON.stringify(data.sidebar)};\n`;
  }
  if (resolvedId === `\0${VIRTUAL.config}`) {
    return `export const config = ${JSON.stringify(data.config)};\n`;
  }
  return undefined;
}
