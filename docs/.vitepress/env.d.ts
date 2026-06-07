/** SFC + CSS shims so tsgo accepts the .vue / .css imports the docs make (theme css, generated
    primitive adapters). Mirrors the shim vow emits into a generated app's vow-env.d.ts.
    Note: stage this alongside any `theme/*.ts` change that adds a .vue/.css import — the staged-only
    pre-commit check needs these ambient shims in its file set to resolve those side-effect imports. */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
declare module "*.css";
