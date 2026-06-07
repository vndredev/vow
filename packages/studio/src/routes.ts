export interface Route {
  /** The clean URL, e.g. "/guide/emit" (or "/" and "/guide/" for index files). */
  readonly path: string;
  /** The source file, relative to the content root, e.g. "guide/emit.md". */
  readonly file: string;
}

/** Turn a content file path into its clean URL: `index.md` → folder URL, else drop the `.md`. */
export function toRoutePath(file: string): string {
  const noExt = file.replace(/\.md$/, "");
  if (noExt === "index") return "/";
  if (noExt.endsWith("/index")) return `/${noExt.slice(0, -"/index".length)}/`;
  return `/${noExt}`;
}

/** Build the route table from the content files (markdown only), sorted by path for determinism. */
export function routes(files: readonly string[]): Route[] {
  return files
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ path: toRoutePath(file), file }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
