/**
 * The boot's glob convention, shared by both sides of the seam. The generated boot globs route + layout
 * fragments by filename SUFFIX and reads them by EXPORT NAME (`emitBoot` in `boot.ts`); the producers
 * (`@vow/vite-plugin`, `@vow/docs`) must write files that match. The string contract lived only on the
 * boot side, so a producer rename (a different suffix or export key) dropped routes with a green build.
 * Pinning the four strings here — imported by every side — turns a mismatch into a build/test failure.
 */

/** The filename suffix the boot globs for route fragments — a producer's routes file must end with it. */
export const ROUTES_SUFFIX = ".routes.ts";

/** The filename suffix the boot globs for the layout SFC — a producer's layout file must end with it. */
export const LAYOUT_SUFFIX = ".layout.vue";

/** The named export the boot reads each route fragment by — a routes module must export this binding. */
export const ROUTES_EXPORT = "routes";

/** The export the boot reads the layout component by — a layout SFC's `<script setup>` is its default. */
export const LAYOUT_EXPORT = "default";
