/** vow's virtual component modules — emitted live by @vow/vite-plugin, never files on disk. */
declare module "virtual:vow/component/*" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
