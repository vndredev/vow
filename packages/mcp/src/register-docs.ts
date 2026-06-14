import type { Names, Registrar, Studio, TextResult } from "./types.ts";
import { json, text } from "./studio.ts";
import { listDocs, readDoc, searchDocs } from "./docs.ts";
import { defined } from "@vow/core";
import { z } from "zod";

/**
 * Register the docs tools — read the SAME `docs/guide/*.md` the site renders, so an agent over MCP stdio
 * reaches the docs through the front door it already uses to operate the studio (no HTTP-only `llms.txt`).
 * `list_docs` enumerates the pages; `read_docs` returns one page's markdown by slug; `search_docs` ranks
 * pages by a query. A missing/absent slug degrades to a plain `no doc "…"` message, never a throw.
 */
export function registerDocs(server: Registrar, names: Names, studio: Studio): void {
  const { appDir } = studio;
  const listDocsTool = names.at("list_docs");
  const readDocsTool = names.at("read_docs");
  const searchDocsTool = names.at("search_docs");

  server.registerTool(
    listDocsTool.name,
    { description: listDocsTool.description, inputSchema: {} },
    () => json(listDocs(appDir)),
  );

  server.registerTool(
    readDocsTool.name,
    { description: readDocsTool.description, inputSchema: { slug: z.string() } },
    (input: { readonly slug: string }): TextResult => {
      const page = readDoc(appDir, input.slug);
      if (defined(page)) {
        return json(page);
      }
      return text(`no doc "${input.slug}" — list_docs enumerates the pages`);
    },
  );

  server.registerTool(
    searchDocsTool.name,
    { description: searchDocsTool.description, inputSchema: { query: z.string() } },
    (input: { readonly query: string }): TextResult => json(searchDocs(appDir, input.query)),
  );
}
