import { LAYOUT_EXPORT, LAYOUT_SUFFIX, ROUTES_EXPORT, ROUTES_SUFFIX } from "./boot-convention.ts";
import { defined, mapDefined } from "@vow/core";
import type { Maybe } from "./types.ts";
import { pascalCase } from "@vow/component";
import { scriptJson } from "./helpers.ts";

/** A routed page — a slug + its title, plus optional sidebar metadata (icon/order/group). */
export interface RoutedPage {
  readonly slug: string;
  readonly title: string;
  readonly icon?: string;
  readonly order?: number;
  readonly group?: string;
}

/** The shell layout knobs a `## shell` may set (nav placement, width, variant). */
export interface ShellSpec {
  readonly nav?: string;
  readonly width?: string;
  readonly variant?: string;
}

/**
 * The app's route table for non-root pages — every `emit view` / `emit form` vow that isn't the root
 * becomes a route at `/<slug>`, lazily loading its `.vue`. Written as a `*.routes.ts` the boot globs (the
 * same seam @vow/docs uses), so the root page stays `/` and these join it — no hand-written router.
 */
export function emitAppRoutes(pages: readonly RoutedPage[]): string {
  return [
    `// Generated routes for the app's pages (views + forms). The vow tree is the source — do not edit.`,
    `import type { Route } from "@vow/router";`,
    ``,
    `export const ${ROUTES_EXPORT}: Route[] = [`,
    ...pages.map(
      (page) =>
        `  { path: "/${page.slug}", load: () => import("./${page.slug}.vue"), title: ${JSON.stringify(page.title)} },`,
    ),
    `];`,
    ``,
  ].join("\n");
}

/**
 * One `Page` literal for the shell's sidebar — icon/group/order only when declared. The literal lands in
 * `emitAppLayout`'s `<script setup>` body, so every free-text value rides `scriptJson` (not bare
 * `JSON.stringify`): a `title`/`icon`/`group` holding `</script>` would otherwise close the SFC's script
 * block early and run the rest as markup (a stored-XSS sink).
 */
function navPageLiteral(page: RoutedPage): string {
  const parts = [`path: "/${page.slug}"`, `title: ${scriptJson(page.title)}`];
  if (defined(page.icon)) {
    parts.push(`icon: ${scriptJson(page.icon)}`);
  }
  if (defined(page.group)) {
    parts.push(`group: ${scriptJson(page.group)}`);
  }
  if (defined(page.order)) {
    parts.push(`order: ${page.order}`);
  }
  return `{ ${parts.join(", ")} }`;
}

/** A `<Shell>` binding — a setup decl + a template attr. */
interface ShellBinding {
  readonly decl: string;
  readonly attr: string;
}

/**
 * A `<Shell>` binding for `name`, present only when its `value` is set. The decl lands in
 * `emitAppLayout`'s `<script setup>` body, so the free-text value (e.g. the app `title`, a nav setting)
 * rides `scriptJson` — a value holding `</script>` cannot close the SFC's script block early.
 */
function shellBinding(name: string, value: Maybe<string>): Maybe<ShellBinding> {
  return mapDefined(value, (set) => ({
    attr: `:${name}="${name}"`,
    decl: `const ${name} = ${scriptJson(set)};`,
  }));
}

/**
 * The app's shared chrome — a thin `*.layout.vue` (the boot globs it, the same seam @vow/docs uses) that
 * wraps every routed page in `@vow/shell`'s dashboard `Shell.vue`, passing the routed `pages`, the current
 * `path` (active link) and the app `title`. The chrome itself is the swappable `@vow/shell` layer; this is
 * only the generated wiring. Emitted only when the app has more than the home page.
 */
export function emitAppLayout(
  pages: readonly RoutedPage[],
  title?: string,
  shell?: ShellSpec,
): string {
  const navPages = pages.map((page) => navPageLiteral(page)).join(", ");
  const decls = [`const pages = [${navPages}];`];
  const attrs = [`:pages="pages"`, `:path="path"`];
  const bindings = [
    shellBinding("title", title),
    shellBinding("nav", shell?.nav),
    shellBinding("width", shell?.width),
    shellBinding("variant", shell?.variant),
  ];
  for (const binding of bindings) {
    if (defined(binding)) {
      decls.push(binding.decl);
      attrs.push(binding.attr);
    }
  }
  return [
    `<script setup lang="ts">`,
    `// Generated app chrome — wraps every page in @vow/shell. The vow tree is the source — do not edit.`,
    `import Shell from "@vow/shell/Shell.vue";`,
    `import "@vow/shell/style.css";`,
    `defineProps<{ path: string }>();`,
    ...decls,
    `</script>`,
    ``,
    `<template>`,
    `  <Shell ${attrs.join(" ")}><slot /></Shell>`,
    `</template>`,
    ``,
  ].join("\n");
}

/**
 * The generated boot — replaces a hand-written `src/main.ts`. Mounts the `root` page on `#app` and
 * imports the default theme. So a vow app needs no boot shell: the entry is a vow (`root: true`).
 */
export function emitBoot(rootSlug: string, theme: string | false = "@vow/theme/vow.css"): string {
  const name = pascalCase(rootSlug);
  const lines = [
    `// Generated boot for the root vow "${rootSlug}". The vow is the source — do not edit.`,
    `import type { Component } from "vue";`,
    `import { createRouter, type Route } from "@vow/router";`,
    `import ${name} from "./${rootSlug}.vue";`,
  ];
  if (theme !== false) {
    lines.push(`import "${theme}";`);
  }
  lines.push(
    ``,
    `// Optional routes + chrome an extension (e.g. @vow/docs) may contribute, by the *.routes.ts /`,
    `// *.layout.vue convention — empty maps when there are none. The boot names no specific extension.`,
    `const fragments = import.meta.glob<{ ${ROUTES_EXPORT}?: Route[] }>("./*${ROUTES_SUFFIX}", { eager: true });`,
    `const docRoutes = Object.values(fragments).flatMap((m) => m.${ROUTES_EXPORT} ?? []);`,
    `const layouts = import.meta.glob<{ ${LAYOUT_EXPORT}: Component }>("./*${LAYOUT_SUFFIX}", { eager: true });`,
    `const layout = Object.values(layouts)[0]?.${LAYOUT_EXPORT};`,
    ``,
    `const routes: Route[] = [`,
    `  { path: "/", load: async () => ({ default: ${name} }) },`,
    `  ...docRoutes,`,
    `];`,
    ``,
    `void createRouter(routes, { layout }).mount("#app");`,
    ``,
  );
  return lines.join("\n");
}

/** Ambient `*.vue` / `*.css` shims the generated boot needs for tsgo — written into `.generated/`. */
export const VOW_ENV_DTS = [
  `/// <reference types="vite/client" />`,
  `/** SFC + CSS shims so tsgo accepts .vue / .css imports (Volar/vue-tsc give the deep check). */`,
  `declare module "*.vue" {`,
  `  import type { DefineComponent } from "vue";`,
  `  const component: DefineComponent;`,
  `  export default component;`,
  `}`,
  `declare module "*.css";`,
  ``,
].join("\n");
