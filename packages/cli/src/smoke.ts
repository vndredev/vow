import { appBySlug, repoRoot } from "./apps.ts";
import { setTimeout as delay } from "node:timers/promises";
import { ensureFree } from "./ports.ts";
import { once } from "node:events";
import { spawn } from "node:child_process";

// The client entry every generated app boots from (the index.html `<script type="module">` src).
const ENTRY = "/.generated/main.ts";
// How long to wait for the dev server to start serving the entry.
const BOOT_ATTEMPTS = 120;
const BOOT_INTERVAL_MS = 500;
// How long to wait after SIGTERM before forcing SIGKILL on the dev child.
const STOP_GRACE_MS = 2000;
const EXIT_OK = 0;
const EXIT_FAIL = 1;

/** A `node:` builtin that reached the BROWSER bundle: `from` imports the Vite-externalized stub, which
    throws on access in the browser. The class of bug that lint + test + build all miss — the production
    build tree-shakes the unused leak away, and the tests run in Node where `node:fs` works. */
export interface NodeLeak {
  readonly from: string;
  readonly stub: string;
}

/** Fetch a dev module's transformed source by its server path; the empty string when it isn't a module. */
export type FetchModule = (path: string) => Promise<string>;

const IMPORT_RE = /(?:from|import)\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gu;

/** The import specifiers in a transformed module body (static `from`/bare + dynamic `import(...)`). */
function importsOf(body: string): readonly string[] {
  const specs: string[] = [];
  for (const match of body.matchAll(IMPORT_RE)) {
    const [, staticSpec, dynamicSpec] = match;
    const spec = staticSpec ?? dynamicSpec ?? "";
    if (spec !== "") {
      specs.push(spec);
    }
  }
  return specs;
}

/** A same-origin absolute module URL — the form Vite's dev server rewrites every local import into. */
function isLocalModule(spec: string): boolean {
  return spec.startsWith("/") && !spec.startsWith("//");
}

// The module path without Vite's `?v=` cache-bust query, so the same module is fetched + seen once.
function moduleUrl(spec: string): string {
  return spec.split("?")[0] ?? spec;
}

/** Crawl the client module graph from `entry`, collecting every `node:` builtin that leaked into it. Pure:
    the fetcher is injected, so the crawl is unit-tested without a running server. The seen-set + frontier
    recursion live in closures, so no mutable collection ever crosses a function boundary. */
export async function findNodeLeaks(
  entry: string,
  fetchModule: FetchModule,
): Promise<readonly NodeLeak[]> {
  const seen = new Set([entry]);

  // One fetched module: its `node:` leaks + the unseen local imports to crawl next.
  const inspect = (
    path: string,
    body: string,
  ): { readonly leaks: readonly NodeLeak[]; readonly next: readonly string[] } => {
    const leaks: NodeLeak[] = [];
    const next: string[] = [];
    for (const spec of importsOf(body)) {
      if (spec.includes("__vite-browser-external")) {
        leaks.push({ from: path, stub: spec });
      } else if (isLocalModule(spec) && !seen.has(moduleUrl(spec))) {
        seen.add(moduleUrl(spec));
        next.push(moduleUrl(spec));
      }
    }
    return { leaks, next };
  };

  /* One breadth-first level — the frontier fetched in parallel, then recurse on the next. Recursive, so
     no `await` ever sits directly in a loop. */
  const crawl = async (frontier: readonly string[]): Promise<readonly NodeLeak[]> => {
    if (frontier.length === 0) {
      return [];
    }
    const found = await Promise.all(
      frontier.map(async (path) => inspect(path, await fetchModule(path))),
    );
    const deeper = await crawl(found.flatMap((result) => result.next));
    return [...found.flatMap((result) => result.leaks), ...deeper];
  };

  const leaks = await crawl([entry]);
  return leaks;
}

interface DevServer {
  readonly stop: () => Promise<void>;
}

/** Spawn one app's `vp dev` silently (output discarded — this is a check, not a session) on its fixed
    port, controlled through a closure so the mutable child never crosses a function boundary. */
function spawnDev(app: string, port: number): DevServer {
  const child = spawn("vp", ["dev", `apps/${app}`, "--port", String(port), "--strictPort"], {
    cwd: repoRoot(),
    stdio: "ignore",
  });
  return {
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      const grace = AbortSignal.timeout(STOP_GRACE_MS);
      const onGrace = (): void => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Gone.
        }
      };
      grace.addEventListener("abort", onGrace, { once: true });
      try {
        child.kill("SIGTERM");
      } catch {
        // Gone.
      }
      await once(child, "exit");
      grace.removeEventListener("abort", onGrace);
    },
  };
}

/** Poll (recursively) until the dev server serves the entry with a 200, or the attempts run out. */
async function waitForEntry(base: string, attemptsLeft: number): Promise<boolean> {
  if (attemptsLeft <= 0) {
    return false;
  }
  try {
    const response = await fetch(`${base}${ENTRY}`);
    if (response.ok) {
      return true;
    }
  } catch {
    // Server not up yet — keep polling.
  }
  await delay(BOOT_INTERVAL_MS);
  return waitForEntry(base, attemptsLeft - 1);
}

/** Fetch a transformed dev module over HTTP; the empty string for anything that isn't a 200 module. */
function fetcherFor(base: string): FetchModule {
  return async (path) => {
    try {
      const response = await fetch(`${base}${path}`);
      if (response.ok) {
        return await response.text();
      }
    } catch {
      // Not a servable module — treat as empty.
    }
    return "";
  };
}

/** Print the leaks to stderr (one block per offending module). */
function report(slug: string, leaks: readonly NodeLeak[]): void {
  process.stderr.write(
    `smoke: ${slug} — ${leaks.length} node-builtin leak(s) in the browser bundle:\n`,
  );
  for (const leak of leaks) {
    process.stderr.write(`  ${leak.from}\n    imports ${leak.stub}\n`);
  }
  process.stderr.write(
    "A node: module reached the client graph — split it out of the browser barrel.\n",
  );
}

/** Boot done — crawl the running app's client graph and report the verdict. */
async function runSmoke(slug: string, base: string): Promise<number> {
  if (!(await waitForEntry(base, BOOT_ATTEMPTS))) {
    process.stderr.write(`smoke: ${slug} dev server never served ${ENTRY} on ${base}\n`);
    return EXIT_FAIL;
  }
  const leaks = await findNodeLeaks(ENTRY, fetcherFor(base));
  if (leaks.length > 0) {
    report(slug, leaks);
    return EXIT_FAIL;
  }
  process.stdout.write(`smoke: ${slug} — client module graph is browser-safe.\n`);
  return EXIT_OK;
}

// A bare `vow smoke` (no app) tests the studio — the dashboard, where the app chrome lives.
function smokeApp(rest: readonly string[]): string {
  const [first] = rest;
  return first ?? "studio";
}

/** `vow smoke [app]` — boot the app's dev server, crawl its client module graph, and FAIL if any `node:`
    builtin leaked into the browser bundle. Spawns + tears down the dev server itself; default app: studio. */
export async function smoke(rest: readonly string[]): Promise<number> {
  const app = appBySlug(smokeApp(rest));
  const base = `http://localhost:${app.port}`;
  await ensureFree(app.port);
  const dev = spawnDev(app.slug, app.port);
  try {
    return await runSmoke(app.slug, base);
  } finally {
    await dev.stop();
  }
}
