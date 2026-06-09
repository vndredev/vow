import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import { loadVows, validateReferences, type Vow as VowNode } from "@vow/core";
import {
  bootstrap,
  type Db,
  get,
  insert,
  list,
  migrate,
  openDb,
  remove,
  resolveDbPath,
  update,
} from "@vow/db";
import { emitBindAnchor } from "@vow/emit-bind";
import { emitEntityModule, emitEntityTest } from "@vow/emit-entity";
import { PRIMITIVE_ADAPTERS } from "@vow/emit-primitive";
import {
  emitAppLayout,
  emitAppRoutes,
  boardComponentName,
  boardRefs,
  cardsComponentName,
  cardsRefs,
  emitBoot,
  emitEntityBoard,
  emitEntityCards,
  emitEntityList,
  emitEntityStats,
  emitForm,
  emitView,
  listedEntities,
  referencedPrimitives,
  statsComponentName,
  statsRefs,
  VOW_ENV_DTS,
  emitIssueBoardSfc,
  emitIssueTableSfc,
  emitTimelineSfc,
  issueLayouts,
  usesTimeline,
  viewComponentName,
} from "@vow/emit-view";
import { layoutSfcs } from "@vow/layout";
import { gitRemoteUrl, gitTimeline, issuePlan, type PlanItem } from "@vow/observability";

/**
 * vow as a Vite plugin — the heart of the closed cap.
 *
 * Source of truth = the visible `app/` folder-tree of `vow.md` ("here lives your app, as MDs").
 * The plugin loads it and writes real `.vue` files into the hidden `.generated/` (gitignored,
 * regenerated) — so vue-tsc, Volar and plugin-vue see them (the hard gate + inspectability), but
 * they're never the source and can't drift. Plus `virtual:vow/tree` exposes the vows as data.
 */

export const VIRTUAL_TREE = "virtual:vow/tree";
const NUL = "\0";

export interface VowOptions {
  /** The visible folder-tree of `vow.md` — your app (default: "app"). */
  readonly dir?: string;
  /** The hidden directory for generated `.vue` — machine output (default: ".generated"). */
  readonly outDir?: string;
  /** Inline vows, bypassing `dir` — for tests. */
  readonly vows?: readonly VowNode[];
  /** The app name, shown as the shell brand (default: the shell's own fallback). */
  readonly title?: string;
}

/** Flatten the tree into every vow, depth-first. */
export function allVows(vows: readonly VowNode[]): VowNode[] {
  return vows.flatMap((v) => [v, ...allVows(v.children)]);
}

/** The entity vows in the tree — the tables the DB schema + the data API are built from. */
function entityVows(vows: readonly VowNode[]): VowNode[] {
  return allVows(vows).filter((v) => v.fulfills?.kind === "emit" && v.fulfills.as === "entity");
}

/**
 * The dev data API — `/__vow/db/<slug>[/<id>]` over `@vow/db` (the browser store fetches it; a Worker
 * serves the same routes over D1 in prod). `db`/`entities` are read live so a regenerate stays in sync.
 */
function dataApi(
  getDb: () => Db | undefined,
  getEntities: () => readonly VowNode[],
): (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void {
  return (req, res, next) => {
    const db = getDb();
    const path = (req.url ?? "/").split("?")[0] ?? "/";
    const [slug, id] = path.replace(/^\/+/, "").split("/");
    const entity = getEntities().find((e) => e.slug === slug);
    if (!db || !entity) return next();
    const send = (status: number, body?: unknown): void => {
      res.statusCode = status;
      if (body === undefined) return void res.end();
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    };
    const withBody = (run: (body: Record<string, unknown>) => void): void => {
      let raw = "";
      req.on("data", (c) => (raw += String(c)));
      req.on("end", () => {
        try {
          run(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
        } catch (err) {
          send(500, { error: (err as Error).message });
        }
      });
    };
    try {
      const m = req.method ?? "GET";
      if (id === undefined) {
        if (m === "GET") return send(200, list(db, entity));
        if (m === "POST") return withBody((b) => send(201, insert(db, entity, b)));
        return send(405);
      }
      if (m === "GET") {
        const r = get(db, entity, id);
        return send(r ? 200 : 404, r);
      }
      if (m === "PATCH") {
        return withBody((b) => {
          const r = update(db, entity, id, b);
          send(r ? 200 : 404, r);
        });
      }
      if (m === "DELETE") return send(remove(db, entity, id) ? 204 : 404);
      send(405);
    } catch (err) {
      send(500, { error: (err as Error).message });
    }
  };
}

/**
 * The dev issue API — `/__vow/issues` serves the GitHub issue plan (`@vow/observability`'s `issuePlan`,
 * gh-direct). The studio's board + roadmap read this; a Worker serves the same over the GitHub API in
 * prod. `gh` shells synchronously, so a short TTL cache keeps a poll from blocking the dev server each call.
 */
function issuesApi(
  cwd: string,
): (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void {
  let cache: { at: number; plan: readonly PlanItem[] } | undefined;
  return (req, res, next) => {
    if ((req.method ?? "GET") !== "GET") return next();
    const now = Date.now();
    if (cache === undefined || now - cache.at > 10_000) cache = { at: now, plan: issuePlan(cwd) };
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(cache.plan));
  };
}

/** The vows as a live ES-module source (observability). */
export function vowTreeModule(vows: readonly VowNode[]): string {
  return `export const tree = ${JSON.stringify(vows)};\nexport default tree;`;
}

/** Resolve a vow's bind module to a specifier the anchor (sitting in outDir) can import. */
function bindSpecifier(module: string, outDir: string, srcDir: string): string {
  if (!module.startsWith(".") && !module.startsWith("/")) return module; // bare package
  const rel = relative(outDir, resolve(srcDir, module));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/**
 * Write the real files per fulfilled vow into outDir, by target:
 *   `emit entity` → `<slug>.ts` + `<slug>.test.ts` (a pure model: type + factory + derived proof)
 *   `emit view`   → `<slug>.vue` from its `## view`; its `list:` references pull in entity lists
 *   `bind`        → `<slug>.bind.ts` (re-export anchor; tsgo verifies the bound export exists)
 * An entity's list view (`<Name>.vue`) is emitted only when a `## view` references it via `list:` —
 * the entity is never auto-rendered. `srcDir` is where the vows + hand-written bind code live (to
 * resolve relative bind modules). Returns the written paths.
 */
export function generateFiles(
  vows: readonly VowNode[],
  outDir: string,
  srcDir: string,
  title?: string,
): string[] {
  validateReferences(vows); // fail loud on a dangling `reference(<entity>)` before generating anything
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const all = allVows(vows);
  const entityBySlug = new Map(
    all
      .filter((e) => e.fulfills?.kind === "emit" && e.fulfills.as === "entity")
      .map((e) => [e.slug, e] as const),
  );
  const entities = [...entityBySlug.keys()]; // slugs a `## view`'s `list:` may reference
  const listed = new Set<string>(); // entity slugs a `## view` actually renders via `list:`
  const statsByKey = new Map<string, { of: string; by: string }>(); // `stats: { of, by }` refs, deduped
  const cardsBySlug = new Set<string>(); // entity slugs a `## view` renders via `cards:`
  const boardByKey = new Map<string, { of: string; by: string }>(); // `board: { of, by }` refs, deduped
  const needed = new Set<string>(); // primitive adapters to materialise (field-driven + view-referenced)
  // non-root views + forms → routes at /<slug>; each carries its `nav:` config for the shell sidebar
  const pages: { slug: string; title: string; icon?: string; order?: number; group?: string }[] =
    [];
  const navPage = (v: VowNode) => ({
    slug: v.slug,
    title: v.nav?.label ?? v.intent,
    icon: v.nav?.icon,
    order: v.nav?.order,
    group: v.nav?.group,
  });
  let needsLayout = false; // any `emit view` pulls in the layout primitives
  let needsTimeline = false; // any `timeline:` view pulls in the git-derived VowTimeline
  const issueViews = new Set<string>(); // `issues: { as }` layouts to materialise (table/board/roadmap)

  for (const v of all) {
    const f = v.fulfills;
    if (!f) continue;
    if (f.kind === "emit" && f.as === "entity") {
      const mod = join(outDir, `${v.slug}.ts`);
      const test = join(outDir, `${v.slug}.test.ts`);
      writeFileSync(mod, emitEntityModule(v), "utf8");
      writeFileSync(test, emitEntityTest(v), "utf8");
      written.push(mod, test);
    } else if (f.kind === "emit" && f.as === "view") {
      if (!v.view) {
        throw new Error(`vow "${v.slug}": an \`emit view\` needs a \`## view\` block`);
      }
      const file = join(outDir, `${v.slug}.vue`);
      writeFileSync(file, emitView(v, entities), "utf8");
      written.push(file);
      for (const slug of listedEntities(v)) listed.add(slug);
      for (const ref of statsRefs(v)) statsByKey.set(`${ref.of}.${ref.by}`, ref); // stats compositions
      for (const slug of cardsRefs(v)) cardsBySlug.add(slug); // cards compositions
      for (const ref of boardRefs(v)) boardByKey.set(`${ref.of}.${ref.by}`, ref); // board compositions
      for (const p of referencedPrimitives(v, entities)) needed.add(p); // primitives placed in the view
      if (v.root !== true) pages.push(navPage(v)); // a non-root view → a route
      if (usesTimeline(v)) needsTimeline = true; // the git-derived roadmap view
      for (const layout of issueLayouts(v)) issueViews.add(layout); // the live GitHub issue views
      needsLayout = true;
    } else if (f.kind === "emit" && f.as === "form") {
      const file = join(outDir, `${v.slug}.vue`);
      writeFileSync(file, emitForm(v, entityBySlug), "utf8");
      written.push(file);
      pages.push(navPage(v)); // a form is always its own page
      const entity = entityBySlug.get(v.form?.of ?? "");
      needed.add("Field").add("Button"); // a form always wraps fields + a submit button
      if (entity?.fields.some((fld) => fld.type === "boolean")) needed.add("Checkbox");
      if (entity?.fields.some((fld) => fld.type === "select" || fld.type === "reference")) {
        needed.add("Select");
      }
    } else if (f.kind === "bind") {
      const file = join(outDir, `${v.slug}.bind.ts`);
      writeFileSync(file, emitBindAnchor(v, bindSpecifier(f.module, outDir, srcDir)), "utf8");
      written.push(file);
    }
  }

  // A view's `list: <entity>` instantiates that entity's CRUD list — emitted here, on demand. Its field
  // types pull in adapters too: boolean → <Checkbox>, select/reference → <Select>.
  for (const slug of listed) {
    const entity = entityBySlug.get(slug);
    if (!entity) continue; // emitView already validated the reference; defensive
    const file = join(outDir, `${viewComponentName(entity)}.vue`);
    writeFileSync(file, emitEntityList(entity, entityBySlug), "utf8");
    written.push(file);
    needed.add("Table").add("TableRow").add("TableHead").add("TableCell"); // read-only: composes the Table parts
    if (entity.fields.some((fld) => fld.type === "select")) needed.add("Badge"); // a select cell → <Badge>
  }

  // A view's `stats: { of, by }` instantiates a counts-by-field composition — emitted here, on demand.
  for (const { of, by } of statsByKey.values()) {
    const entity = entityBySlug.get(of);
    if (!entity) continue; // emitView already validated the reference; defensive
    const file = join(outDir, `${statsComponentName(of, by)}.vue`);
    writeFileSync(file, emitEntityStats(entity, by), "utf8");
    written.push(file);
    needed.add("Stats").add("Stat"); // the stats composition composes the Stats/Stat primitives
  }

  // A view's `cards: <entity>` instantiates a card-per-record composition — emitted here, on demand.
  for (const slug of cardsBySlug) {
    const entity = entityBySlug.get(slug);
    if (!entity) continue; // emitView already validated the reference; defensive
    const file = join(outDir, `${cardsComponentName(slug)}.vue`);
    writeFileSync(file, emitEntityCards(entity), "utf8");
    written.push(file);
    needed.add("Card").add("CardHeader").add("CardBody"); // the cards composition composes the Card parts
  }

  // A view's `board: { of, by }` instantiates a kanban composition — emitted here, on demand.
  for (const { of, by } of boardByKey.values()) {
    const entity = entityBySlug.get(of);
    if (!entity) continue; // emitView already validated the reference; defensive
    const file = join(outDir, `${boardComponentName(of, by)}.vue`);
    writeFileSync(file, emitEntityBoard(entity, by), "utf8");
    written.push(file);
    needed.add("Card").add("CardHeader").add("CardBody"); // the board composition composes the Card parts
  }

  // A `timeline:` view → the git-derived VowTimeline, baked from `git log` at generate time (once).
  if (needsTimeline) {
    const file = join(outDir, "VowTimeline.vue");
    writeFileSync(file, emitTimelineSfc(gitTimeline(srcDir), gitRemoteUrl(srcDir)), "utf8");
    written.push(file);
    needed.add("Badge").add("Collapsible"); // the timeline composes Badge + Collapsible
  }
  if (issueViews.has("table")) {
    const file = join(outDir, "VowIssueTable.vue");
    writeFileSync(file, emitIssueTableSfc(), "utf8"); // a fixed component; reads /__vow/issues live
    written.push(file);
    needed.add("Badge"); // the table composes Badge for status + labels
  }
  if (issueViews.has("board")) {
    const file = join(outDir, "VowIssueBoard.vue");
    writeFileSync(file, emitIssueBoardSfc(), "utf8"); // the live issue kanban by derived status
    written.push(file);
    needed.add("Badge");
  }
  // Materialise every needed primitive adapter once, from the closed registry (on demand → lean output).
  for (const name of needed) {
    const emit = PRIMITIVE_ADAPTERS[name];
    if (emit === undefined) continue; // closed registry — defensive
    const file = join(outDir, `${name}.vue`);
    writeFileSync(file, emit(), "utf8");
    written.push(file);
  }
  // A `## view` imports `./<Primitive>.vue`; emit the layout primitives so those resolve (and are
  // themselves type-checked by `vp check`). Written wholesale — the unused ones are harmless.
  if (needsLayout) {
    for (const { name, sfc } of layoutSfcs()) {
      const file = join(outDir, `${name}.vue`);
      writeFileSync(file, sfc, "utf8");
      written.push(file);
    }
  }
  // Non-root views + forms become routes (`/<slug>`) the boot globs via the `*.routes.ts` convention —
  // so the root page stays `/` and every other page joins it, with no hand-written router. With more than
  // the home page, also emit a shared chrome (`*.layout.vue`) — a nav over every page.
  // The app's entry: a `root: true` page. Its frontmatter `title:` is the app-shell brand (falling back
  // to the plugin option) — so the shell title is declared in the vow, not in vite.config.
  const rootVow = all.find((v) => v.root === true && v.view);
  const appTitle = rootVow?.title ?? title;
  const appShell = rootVow?.shell; // the shell layout (nav · width · variant), declared on the root vow
  if (pages.length > 0) {
    const routes = join(outDir, "vow-pages.routes.ts");
    writeFileSync(routes, emitAppRoutes(pages), "utf8");
    const layout = join(outDir, "vow-app.layout.vue");
    writeFileSync(layout, emitAppLayout(pages, appTitle, appShell), "utf8");
    written.push(routes, layout);
  }
  // Generate the boot (main.ts) + the *.vue/*.css shims, so the app needs no hand-written `src/` shell —
  // index.html loads `.generated/main.ts`.
  if (rootVow) {
    const boot = join(outDir, "main.ts");
    const env = join(outDir, "vow-env.d.ts");
    writeFileSync(boot, emitBoot(rootVow.slug), "utf8");
    writeFileSync(env, VOW_ENV_DTS, "utf8");
    written.push(boot, env);
  }
  return written;
}

/** Resolve the tree virtual id to its NUL-prefixed form; ignore everything else. */
export function resolveVowId(id: string): string | undefined {
  return id === VIRTUAL_TREE ? NUL + id : undefined;
}

/** Load the tree virtual module (the vows as data); ignore everything else. */
export function loadVowModule(id: string, vows: readonly VowNode[]): string | undefined {
  return id === NUL + VIRTUAL_TREE ? vowTreeModule(vows) : undefined;
}

/** vow as a Vite plugin: load `app/`, generate real `.vue` into `.generated/`, expose the tree. */
export function vow(options: VowOptions = {}): Plugin {
  const dirOpt = options.dir ?? "app";
  const outOpt = options.outDir ?? ".generated";
  let vows: readonly VowNode[] = options.vows ?? [];
  let vowDir = dirOpt;
  let genDir = outOpt;
  let lastWritten = new Set<string>(); // what this plugin wrote last run — to clean up deleted vows
  let root = ".";
  let db: Db | undefined; // the local SQLite handle, opened when the dev server starts
  let entities: readonly VowNode[] = []; // the entity vows → the DB tables + the data API

  const regenerate = (): void => {
    vows = options.vows ?? loadVows(vowDir);
    const written = generateFiles(vows, genDir, vowDir, options.title);
    // a vow's `.md` was deleted → remove the files this plugin wrote before but not now, so generated
    // output never outlives its source. Only our own files are touched — another plugin's stay (e.g.
    // `@vow/docs` shares `.generated/`).
    const current = new Set(written);
    for (const file of lastWritten) if (!current.has(file)) rmSync(file, { force: true });
    lastWritten = current;

    // the data layer: recompute the entity tables; if the dev DB is open, keep its schema + seed live
    entities = entityVows(vows);
    if (db) {
      migrate(db, entities);
      bootstrap(db, entities);
    }
  };

  return {
    name: "vow",
    configResolved(config) {
      root = config.root;
      vowDir = isAbsolute(dirOpt) ? dirOpt : join(config.root, dirOpt);
      genDir = isAbsolute(outOpt) ? outOpt : join(config.root, outOpt);
      try {
        regenerate();
      } catch (err) {
        // a broken vow at startup shouldn't abort the dev server — log it; the watcher recovers on the
        // next save (and `vp build` still fails loud, so it can't ship).
        config.logger.error(`[vow] generation failed: ${(err as Error).message}`);
      }
    },
    configureServer(server) {
      // The local SQLite DB the studio reads (and the MCP shares) — opened once; the data API serves it.
      db = openDb(resolveDbPath(root));
      migrate(db, entities);
      bootstrap(db, entities);
      server.middlewares.use(
        "/__vow/db",
        dataApi(
          () => db,
          () => entities,
        ),
      );
      server.middlewares.use("/__vow/issues", issuesApi(root)); // the GitHub issue plan, gh-direct

      // Watch the `app/` source (not in the module graph) → regenerate the `.vue` on change.
      // Rewriting the .vue then triggers plugin-vue's HMR; a full reload covers added/removed vows.
      server.watcher.add(vowDir);
      const onVowChange = (file: string): void => {
        if (!file.startsWith(vowDir) || !file.endsWith(".md")) return;
        try {
          regenerate();
          server.ws.send({ type: "full-reload" });
        } catch (err) {
          // a bad save mid-edit must NOT crash the server — surface it in the Vite error overlay and
          // keep serving the last good output; the next valid save clears it.
          const e = err as Error;
          server.config.logger.error(`[vow] generation failed: ${e.message}`);
          server.ws.send({ type: "error", err: { message: e.message, stack: e.stack ?? "" } });
        }
      };
      server.watcher.on("add", onVowChange);
      server.watcher.on("change", onVowChange);
      server.watcher.on("unlink", onVowChange);
    },
    resolveId: (id) => resolveVowId(id),
    load: (id) => loadVowModule(id, vows),
  };
}
