/**
 * @vow/shell — the app-chrome layer for generated vow apps (the sibling of @vow/docs, which is the
 * docs-chrome layer). It ships hand-written `.vue` chrome (a dashboard shell: a sidebar nav + a content
 * area, a mobile drawer) that composes vow's own primitives + @vow/theme tokens. The generated
 * `vow-app.layout.vue` imports `Shell.vue` + `style.css` and passes the routed pages — the shell is a
 * swappable layer, like the theme.
 */

/** One navigable page in the shell's sidebar nav. */
export interface Page {
  readonly path: string;
  readonly title: string;
}
