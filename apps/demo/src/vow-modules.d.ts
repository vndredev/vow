/** SFC shim so tsgo accepts `.vue` imports (Volar/vue-tsc give the real, deep type check). */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}

/** CSS side-effect imports (e.g. a theme) carry no types. */
declare module "*.css";
