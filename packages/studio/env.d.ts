/** SFC + CSS shims so tsgo accepts the .vue / .css imports the studio makes (app shell, page
    components, generated primitive adapters). Mirrors the shim vow emits into a generated app. */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
declare module "*.css";
