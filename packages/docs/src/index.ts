/**
 * @vow/docs — reusable docs for any vow app. It scans a folder of plain `.md` content and generates a
 * prose `.vue` per file, rendered through the core (`@vow/markdown` → `emitProse`) — vow-native, not a
 * parallel doc-system. The content stays as markdown; the rendering is generated + dogfooded.
 *
 * The module is split by concern: `types` (the public shapes), `paths` (slug/route derivation), `sidebar`
 * + `llms` (the two derived indexes), `manifest` + `sfc` (the generated module + component sources),
 * `generate` (the scan orchestrator), and `plugin` (the Vite integration). This barrel re-exports the API.
 */

export { generateDocs } from "./generate.ts";
export { buildLlms, cleanBody, firstSentence } from "./llms.ts";
export { docSlug, routePath } from "./paths.ts";
export { vowDocs } from "./plugin.ts";
export { buildSidebar } from "./sidebar.ts";
export type {
  DocsConfig,
  GenerateDocsOptions,
  LlmsEntry,
  NavLink,
  PageMeta,
  SearchItem,
  SidebarGroup,
  SidebarItem,
  TocEntry,
  VowDocsOptions,
} from "./types.ts";
