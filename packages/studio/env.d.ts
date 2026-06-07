/** SFC + CSS shims so tsgo accepts the .vue / .css imports the studio makes (app shell, page
    components, generated primitive adapters). Mirrors the shim vow emits into a generated app. */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
declare module "*.css";

/** The virtual modules studioDocs() serves — typed so the app shell + entries resolve them. Ambient
    module declarations can't use relative imports, so these reference the package by name. */
declare module "virtual:vow-studio/routes" {
  import type { RouteDef } from "@vow/studio";
  export const routes: RouteDef[];
}
declare module "virtual:vow-studio/sidebar" {
  import type { SidebarGroup } from "@vow/studio";
  export const sidebar: SidebarGroup[];
}
declare module "virtual:vow-studio/config" {
  import type { StudioConfig } from "@vow/studio";
  export const config: StudioConfig;
}
