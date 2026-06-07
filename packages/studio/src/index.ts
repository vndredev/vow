/**
 * @vow/studio — vow's view system. It renders markdown pages AND (later) the vow forest into a themed,
 * navigable site on Vite+, replacing VitePress. Living docs today; a planning/board view over the same
 * forest tomorrow — one source, many views.
 *
 * Built phase by phase (see the plan). The markdown compiler (compile), the route table (routes), the
 * sidebar (buildSidebar) and config (defineStudio) are in place; the Vite plugin, app shell and SSG
 * build land next.
 */

export { compile, type CompiledPage, type CompileOptions } from "./markdown/compile.ts";
export { type TocEntry } from "./markdown/toc.ts";
export { defineStudio, type StudioConfig, type NavLink } from "./config.ts";
export { routes, toRoutePath, type Route } from "./routes.ts";
export { buildSidebar, type Page, type SidebarGroup, type SidebarItem } from "./sidebar.ts";
export { discover, type Discovered } from "./discover.ts";
export { studioDocs, compileMarkdownModule, type StudioOptions } from "./plugin.ts";
export {
  matchRoute,
  createStudioRouter,
  type RouteDef,
  type PageModule,
  type StudioRouter,
} from "../theme/router.ts";
