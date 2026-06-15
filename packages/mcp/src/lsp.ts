/* oxlint-disable consistent-type-specifier-style -- vscode-languageserver-protocol exposes values (the
   Request/Notification descriptors) and types (Location/Hover/...) from ONE module; a separate top-level
   type import would trip no-duplicate-imports (the sanctioned #704 value+type boundary pattern) */
import {
  DidOpenTextDocumentNotification,
  type DocumentSymbol,
  DocumentSymbolRequest,
  type Hover,
  HoverRequest,
  InitializeRequest,
  InitializedNotification,
  type Location,
  type MarkupContent,
  PublishDiagnosticsNotification,
  type PublishDiagnosticsParams,
  type ReferenceParams,
  ReferencesRequest,
  type SymbolInformation,
  type TextDocumentPositionParams,
} from "vscode-languageserver-protocol";
import {
  type Disposable,
  type MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection,
} from "vscode-jsonrpc/node";
import { type Maybe, NONE, defined } from "@vow/core";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);

/** The bundled typescript-language-server entry — resolved through node from `@vow/mcp`'s own dependency, so
 *  the LSP server travels with the package (no global install; provider-neutral: any harness spawns it). */
function serverEntry(): string {
  return require.resolve("typescript-language-server/lib/cli.mjs");
}

/** The LSP `languageId` for a source file, keyed off its extension — the server's parser needs it. */
function languageId(file: string): string {
  const ext = path.extname(file);
  if (ext === ".tsx") {
    return "typescriptreact";
  }
  if (ext === ".jsx") {
    return "javascriptreact";
  }
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    return "javascript";
  }
  return "typescript";
}

/** A live LSP session — the JSON-RPC connection to a spawned server + the file URIs already opened (the
 *  server resolves a position query only against a document it has been sent). */
interface Session {
  readonly connection: MessageConnection;
  readonly opened: Set<string>;
}

let current: Maybe<Session> = NONE;

/** Spawn the server, wire its stdio to a JSON-RPC connection, and run the initialize handshake. The child's
 *  stdout/stdin are inherently-mutable Node streams handed to the reader/writer — the OS-adapter boundary. */
async function startSession(root: string): Promise<Session> {
  const child = spawn(process.execPath, [serverEntry(), "--stdio"], { cwd: root });
  // oxlint-disable-next-line prefer-readonly-parameter-types -- a Node child's stdout/stdin are mutable streams
  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  connection.listen();
  const uri = pathToFileURL(root).href;
  await connection.sendRequest(InitializeRequest.type.method, {
    capabilities: {
      textDocument: {
        documentSymbol: { hierarchicalDocumentSymbolSupport: true },
        hover: { contentFormat: ["plaintext", "markdown"] },
        references: {},
      },
      workspace: { workspaceFolders: true },
    },
    processId: process.pid,
    rootUri: uri,
    workspaceFolders: [{ name: "vow", uri }],
  });
  await connection.sendNotification(InitializedNotification.type.method, {});
  return { connection, opened: new Set<string>() };
}

/** The cached session — started once and reused (initialize is expensive), so each query is just an open +
 *  a position request. */
async function session(): Promise<Session> {
  const existing = current;
  if (defined(existing)) {
    return existing;
  }
  const started = await startSession(process.cwd());
  current = started;
  return started;
}

/** The fallback before a query proceeds without a readiness signal (ms) — a server that never publishes
 *  diagnostics (already-warm, or silent) must not hang the call. */
const READY_MS = 30_000;

/** Resolve once the server publishes diagnostics for `uri` — typescript-language-server analyses the file's
 *  whole PROJECT to produce them, so this is the "the program is built, cross-file queries are now complete"
 *  readiness signal (without it a cold `references` returns only the open file's uses). Subscribed BEFORE the
 *  `didOpen` so the notification is never missed; falls back after `READY_MS` so a silent server never hangs. */
// oxlint-disable-next-line prefer-readonly-parameter-types, promise-function-async -- the session holds a mutable connection (boundary); an event-to-promise bridge isn't async (an async wrapper would trip require-await)
function awaitReady(active: Session, uri: string): Promise<void> {
  // oxlint-disable-next-line avoid-new -- an event-to-promise bridge: wraps the one-shot diagnostics listener into an awaitable readiness signal
  return new Promise<void>((resolve) => {
    const subs: Disposable[] = [];
    const finish = (): void => {
      for (const sub of subs) {
        sub.dispose();
      }
      resolve();
    };
    const timer = setTimeout(finish, READY_MS);
    // oxlint-disable-next-line prefer-readonly-parameter-types -- the LSP diagnostics params (boundary), only read
    const onDiag = (params: PublishDiagnosticsParams): void => {
      if (params.uri === uri) {
        clearTimeout(timer);
        finish();
      }
    };
    subs.push(active.connection.onNotification(PublishDiagnosticsNotification.type, onDiag));
  });
}

/** Open `file` in `active` if it isn't already — the server resolves a query against an opened document, so
 *  read the file off disk, notify the server, and WAIT for it to build the project (readiness) before the
 *  caller queries. Returns the file's `file://` uri. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- the session's `opened` Set is mutated here (the document cache)
async function openDoc(active: Session, file: string): Promise<string> {
  const abs = path.resolve(file);
  const uri = pathToFileURL(abs).href;
  if (active.opened.has(uri)) {
    return uri;
  }
  const text = readFileSync(abs, "utf8");
  const ready = awaitReady(active, uri);
  await active.connection.sendNotification(DidOpenTextDocumentNotification.type.method, {
    textDocument: { languageId: languageId(abs), text, uri, version: 1 },
  });
  active.opened.add(uri);
  await ready;
  return uri;
}

/** The `{ textDocument, position }` an at-position query takes — a 0-based LSP position from the 1-based
 *  line/character a user reads in an editor. */
async function posParams(
  file: string,
  line: number,
  character: number,
): Promise<TextDocumentPositionParams> {
  const ONE = 1;
  const active = await session();
  const uri = await openDoc(active, file);
  return { position: { character: character - ONE, line: line - ONE }, textDocument: { uri } };
}

/** One element of a hover `contents` array — a string or a `{ value }` marked-string — as plain text. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- an LSP MarkedString union (boundary type), only read
function partText(part: string | MarkupContent | { value: string }): string {
  if (typeof part === "string") {
    return part;
  }
  return part.value;
}

/** Flatten an LSP hover's `contents` (a string, a `MarkupContent`, or an array of those) to plain text. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- the LSP `Hover` type (boundary), only read here
function hoverText(result: Hover): string {
  const { contents } = result;
  if (typeof contents === "string") {
    return contents;
  }
  if (Array.isArray(contents)) {
    const parts: string[] = [];
    for (const part of contents) {
      parts.push(partText(part));
    }
    return parts.join("\n");
  }
  return contents.value;
}

/** Find every reference to the symbol at `file:line:character` — the semantic "who uses this", resolved
 *  through imports (never a comment or string the way text search matches). */
export async function findReferences(
  file: string,
  line: number,
  character: number,
): Promise<readonly Location[]> {
  const active = await session();
  const params: ReferenceParams = {
    ...(await posParams(file, line, character)),
    context: { includeDeclaration: true },
  };
  return (await active.connection.sendRequest(ReferencesRequest.type, params)) ?? [];
}

/** The hover text (type signature + doc) for the symbol at `file:line:character`. */
export async function hover(file: string, line: number, character: number): Promise<string> {
  const active = await session();
  const result = await active.connection.sendRequest(
    HoverRequest.type,
    await posParams(file, line, character),
  );
  if (result) {
    return hoverText(result);
  }
  return "";
}

/** Every symbol declared in `file` — functions, classes, constants — with its kind + position. */
export async function documentSymbols(
  file: string,
): Promise<readonly (DocumentSymbol | SymbolInformation)[]> {
  const active = await session();
  const uri = await openDoc(active, file);
  return (
    (await active.connection.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } })) ??
    []
  );
}
