import { documentSymbols, findReferences } from "../src/lsp.ts";
import { expect, test } from "vite-plus/test";

// An integration smoke test spawning the bundled typescript-language-server against real source files.
// It proves the JSON-RPC handshake plus the document + position queries work end-to-end. The server builds
// The whole project on the first query, so the timeout is generous.
const SLOW = 60_000;
const FETCH_PRUNE_LINE = 36;
const FETCH_PRUNE_CHAR = 17;

test(
  "documentSymbols returns a file's real symbol tree (the spawned LSP server)",
  async () => {
    const symbols = await documentSymbols("packages/agent/src/verify.ts");
    const names: string[] = [];
    for (const symbol of symbols) {
      names.push(symbol.name);
    }
    expect(names).toContain("pushArgs");
    expect(names).toContain("fetchPruneArgs");
  },
  SLOW,
);

test(
  "findReferences resolves a symbol's real uses across files (not text matches)",
  async () => {
    const refs = await findReferences(
      "packages/agent/src/verify.ts",
      FETCH_PRUNE_LINE,
      FETCH_PRUNE_CHAR,
    );
    const files = new Set<string>();
    for (const ref of refs) {
      files.add(ref.uri.replace(/^.*\/packages\//u, "packages/"));
    }
    expect(files.has("packages/agent/src/verify.ts")).toBe(true);
    expect(files.has("packages/agent/src/loop.ts")).toBe(true);
  },
  SLOW,
);
