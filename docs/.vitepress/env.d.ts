/** SFC + CSS shims so tsgo accepts the .vue / .css imports the docs make (theme css, generated
    primitive adapters). Mirrors the shim vow emits into a generated app's vow-env.d.ts. */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
declare module "*.css";
