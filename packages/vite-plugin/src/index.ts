// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Db, openDevDb, syncEntities } from "./dev-db.ts";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Maybe, type ReadonlyVow, defined, loadVows } from "@vow/core/node";
import {
  NONE,
  VOW_API,
  agentApi,
  dataApi,
  eventsApi,
  issueApi,
  issuesApi,
  loopStatusApi,
  repoRootOf,
} from "./dev-api.ts";
import type { Plugin, ViteDevServer } from "vite-plus";
import { devOverlayTags, loadVowModule, resolveVowId } from "./virtual.ts";
import type { VowOptions } from "./vows.ts";
import { generateFiles } from "./generate.ts";
import { mcpStatusApi } from "./mcp-status-handler.ts";
import path from "node:path";
import { rmSync } from "node:fs";

/**
 * The vow Vite plugin — the heart of the closed cap.
 *
 * Source of truth = the visible `app/` folder-tree of `vow.md` ("here lives your app, as MDs"). The plugin
 * loads it and writes real `.vue` files into the hidden `.generated/` (gitignored, regenerated) — so
 * vue-tsc, Volar and plugin-vue see them (the hard gate + inspectability), but they're never the source and
 * can't drift. Plus `virtual:vow/tree` exposes the vows as data, and `/__vow` serves the dev data + issues.
 */

export { allVows } from "./vows.ts";
export type { VowOptions } from "./vows.ts";
export { caseCollision, type Dirs, generateFiles } from "./generate.ts";
export { loadVowModule, resolveVowId, VIRTUAL_TREE, vowTreeModule } from "./virtual.ts";

/** The error message of an unknown throw — a string guard, never a cast to `Error`. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/** The error stack of an unknown throw, or the empty string when there is none. */
function errorStack(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? "";
  }
  return "";
}

/** Resolve a configured dir against the project root — an absolute path is taken as-is. */
function resolveDir(root: string, dir: string): string {
  if (path.isAbsolute(dir)) {
    return dir;
  }
  return path.join(root, dir);
}

/** The mutable state the plugin threads through its hooks — the live tree, dirs, DB, and entity tables. */
export interface State {
  vows: readonly ReadonlyVow[];
  vowDir: string;
  genDir: string;
  lastWritten: readonly string[];
  root: string;
  db: Maybe<Db>;
  entities: readonly ReadonlyVow[];
  /** Whether the build is a dev server (`serve`) — gates the in-app reporter overlay to dev only. */
  dev: boolean;
}

/** Remove the files this plugin wrote before but not now, so generated output never outlives its source. */
function pruneStale(previous: readonly string[], written: readonly string[]): void {
  // Only our own files are touched — another plugin's stay (e.g. @vow/docs shares `.generated/`).
  const current = new Set(written);
  for (const file of previous) {
    if (!current.has(file)) {
      rmSync(file, { force: true });
    }
  }
}

/** Load the tree, write the artifacts, prune deleted vows' files, and keep the dev DB schema + seed live. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- regenerate mutates the live plugin state
function regenerate(state: State, options: VowOptions): void {
  state.vows = options.vows ?? loadVows(state.vowDir);
  const written = generateFiles(
    state.vows,
    { outDir: state.genDir, srcDir: state.vowDir },
    { theme: options.theme, title: options.title },
  );
  pruneStale(state.lastWritten, written);
  state.lastWritten = written;
  if (defined(state.db)) {
    state.entities = syncEntities(state.db, state.vows);
  }
}

/**
 * Open the dev DB + sync its schema, guarded: a corrupt `.vow/data.db` must not abort the dev server.
 * On failure it logs via `logError`, leaves the DB absent (the data API then `next()`s past every
 * `/__vow/db` request), and the watcher + sibling startup paths stay alive — symmetric with the two
 * already-guarded regenerate paths. A `file is not a database` error also logs the remedy.
 */
// oxlint-disable-next-line prefer-readonly-parameter-types -- openDb mutates state.db / state.entities
export function openDevDbGuarded(state: State, logError: (message: string) => void): void {
  try {
    const db = openDevDb(state.root);
    state.db = db;
    state.entities = syncEntities(db, state.vows);
  } catch (error) {
    const message = errorMessage(error);
    logError(`[vow] dev DB open failed: ${message}`);
    if (message.includes("file is not a database")) {
      logError("[vow] the `.vow/data.db` is corrupt — delete it and restart.");
    }
    state.db = NONE;
  }
}

/** Mount every `/__vow` API on the dev server's middleware chain — the data layer, the issue plan + the
 *  in-app reporter, the event feed, the start-work signal, and the agent-loop status. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- a plugin must mutate the dev server
function mountApis(server: ViteDevServer, state: State): void {
  server.middlewares.use(
    VOW_API.db,
    dataApi(
      () => state.db,
      () => state.entities,
    ),
  );
  // The GitHub issue plan, gh-direct.
  server.middlewares.use(VOW_API.issues, issuesApi(state.root));
  // The append-only event feed (JSON snapshot + SSE), read from the REPO-ROOT `.vow/events.jsonl`.
  // The loop records there, not to the app-local `state.root`, so the trace shows its live events.
  // `repoRootOf` walks up from the studio's app dir to the workspace root — the SAME resolution below.
  // The `state.root` fallback covers a standalone app with no workspace root above (its own app-local feed).
  server.middlewares.use(VOW_API.events, eventsApi(repoRootOf(state.root) ?? state.root));
  // The start-work signal — a board action POSTs an issue number; the dev server dispatches its agent run.
  server.middlewares.use(VOW_API.agent, agentApi(state.root));
  // The in-app reporter — the dev overlay POSTs a bug/feature report; the server files it as a phased issue.
  server.middlewares.use(VOW_API.issue, issueApi(state.root));
  // The agent-loop status — read from the REPO-ROOT `.vow/` the loop records (not the app-local `state.root`).
  // The studio under `apps/studio` thus still reads the loop process's live state. The fallback to
  // `state.root` covers a standalone app with no workspace root above (where it reads the idle default).
  server.middlewares.use(VOW_API.agentLoop, loopStatusApi(repoRootOf(state.root) ?? state.root));
  // The MCP/channel health status — derived from the same REPO-ROOT event feed as the loop status.
  server.middlewares.use(VOW_API.mcp, mcpStatusApi(repoRootOf(state.root) ?? state.root));
}

/** Wire the dev server: open the DB, mount the `/__vow` APIs, and watch `app/` for regenerate-on-save. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- a plugin must mutate the dev server
function setupServer(server: ViteDevServer, state: State, options: VowOptions): void {
  openDevDbGuarded(state, (message) => {
    server.config.logger.error(message);
  });
  mountApis(server, state);

  // Watch the `app/` source (not in the module graph) → regenerate the `.vue` on change. Rewriting the
  // .vue then triggers plugin-vue's HMR; a full reload covers added/removed vows.
  server.watcher.add(state.vowDir);
  const onVowChange = (file: string): void => {
    if (!file.startsWith(state.vowDir) || !file.endsWith(".md")) {
      return;
    }
    try {
      regenerate(state, options);
      server.ws.send({ type: "full-reload" });
    } catch (error) {
      // A bad save mid-edit must NOT crash the server. The error surfaces in the Vite overlay.
      // Meanwhile the last good output keeps serving, and the next valid save clears the overlay.
      server.config.logger.error(`[vow] generation failed: ${errorMessage(error)}`);
      server.ws.send({
        err: { message: errorMessage(error), stack: errorStack(error) },
        type: "error",
      });
    }
  };
  server.watcher.on("add", onVowChange);
  server.watcher.on("change", onVowChange);
  server.watcher.on("unlink", onVowChange);
}

/** The vow Vite plugin: load `app/`, generate real `.vue` into `.generated/`, expose the tree. */
export function vow(options: VowOptions = {}): Plugin {
  const dirOpt = options.dir ?? "app";
  const outOpt = options.outDir ?? ".generated";
  const state: State = {
    db: NONE,
    dev: false,
    entities: [],
    genDir: outOpt,
    lastWritten: [],
    root: ".",
    vowDir: dirOpt,
    vows: options.vows ?? [],
  };

  return {
    // oxlint-disable-next-line prefer-readonly-parameter-types -- Vite's ResolvedConfig is read here
    configResolved(config) {
      state.root = config.root;
      state.dev = config.command === "serve";
      state.vowDir = resolveDir(config.root, dirOpt);
      state.genDir = resolveDir(config.root, outOpt);
      try {
        regenerate(state, options);
      } catch (error) {
        // A broken vow at startup shouldn't abort the dev server: log it, the watcher recovers on save.
        // Build still fails loud (`vp build`), so a broken vow can never ship.
        config.logger.error(`[vow] generation failed: ${errorMessage(error)}`);
      }
    },
    // oxlint-disable-next-line prefer-readonly-parameter-types -- a plugin must mutate the dev server
    configureServer(server) {
      setupServer(server, state, options);
    },
    load: (id) => loadVowModule(id, state.vows),
    name: "vow",
    resolveId: (id) => resolveVowId(id),
    // Inject the in-app reporter overlay — in dev only, so it never ships to a production build.
    transformIndexHtml: () => devOverlayTags(state.dev),
  };
}
