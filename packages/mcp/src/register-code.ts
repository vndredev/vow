import type { DocumentSymbol, Location, SymbolInformation } from "vscode-languageserver-protocol";
import type { Names, Registrar, TextResult } from "./types.ts";
import { documentSymbols, findReferences, hover } from "./lsp.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { text } from "./studio.ts";
import { z } from "zod";

const ONE = 1;

/** A `file://` uri as a repo-relative path — the readable form the text result shows. */
function relPath(uri: string): string {
  return path.relative(process.cwd(), fileURLToPath(uri));
}

/** The references as a `path:line` list, one per line — the semantic "who uses this". */
// oxlint-disable-next-line prefer-readonly-parameter-types -- an array of LSP `Location` (boundary types), read only
function formatReferences(refs: readonly Location[]): string {
  if (refs.length === 0) {
    return "no references found";
  }
  const lines: string[] = [];
  for (const ref of refs) {
    lines.push(`${relPath(ref.uri)}:${ref.range.start.line + ONE}`);
  }
  return lines.join("\n");
}

/** The 1-based declaration line of a symbol — a hierarchical `DocumentSymbol` or a flat `SymbolInformation`. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- an LSP symbol (boundary union type), read only
function symbolLine(symbol: DocumentSymbol | SymbolInformation): number {
  if ("location" in symbol) {
    return symbol.location.range.start.line + ONE;
  }
  return symbol.range.start.line + ONE;
}

/** The symbols as a `name (line N)` list. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- an array of LSP symbols (boundary types), read only
function formatSymbols(symbols: readonly (DocumentSymbol | SymbolInformation)[]): string {
  if (symbols.length === 0) {
    return "no symbols found";
  }
  const lines: string[] = [];
  for (const symbol of symbols) {
    lines.push(`${symbol.name} (line ${symbolLine(symbol)})`);
  }
  return lines.join("\n");
}

/** Register the code-intelligence tools — semantic lookups (find references / list symbols / hover) over the
 *  workspace via the bundled LSP server, so ANY MCP-capable agent gets them, provider-neutral (#709). They
 *  read code, never write, so they take no `studio`. */
export function registerCode(server: Registrar, names: Names): void {
  const refsTool = names.at("find_references");
  const symbolsTool = names.at("document_symbols");
  const hoverTool = names.at("hover");

  server.registerTool(
    refsTool.name,
    {
      description: refsTool.description,
      inputSchema: { character: z.number(), file: z.string(), line: z.number() },
    },
    async (input: {
      readonly character: number;
      readonly file: string;
      readonly line: number;
    }): Promise<TextResult> => {
      const refs = await findReferences(input.file, input.line, input.character);
      return text(formatReferences(refs));
    },
  );

  server.registerTool(
    symbolsTool.name,
    { description: symbolsTool.description, inputSchema: { file: z.string() } },
    async (input: { readonly file: string }): Promise<TextResult> => {
      const symbols = await documentSymbols(input.file);
      return text(formatSymbols(symbols));
    },
  );

  server.registerTool(
    hoverTool.name,
    {
      description: hoverTool.description,
      inputSchema: { character: z.number(), file: z.string(), line: z.number() },
    },
    async (input: {
      readonly character: number;
      readonly file: string;
      readonly line: number;
    }): Promise<TextResult> => {
      const info = await hover(input.file, input.line, input.character);
      if (info === "") {
        return text("no hover info");
      }
      return text(info);
    },
  );
}
