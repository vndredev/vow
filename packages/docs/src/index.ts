import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import {
  emitCheckboxSfc,
  emitCollapsibleSfc,
  emitDialogSfc,
  emitSelectSfc,
  emitTabsSfc,
} from "@vow/emit-primitive";
import { emitProse } from "@vow/emit-view";
import { getHighlighter, markdownToNodesSync } from "@vow/markdown";

/**
 * @vow/docs — reusable docs for any vow app. It scans a folder of plain `.md` content and generates a
 * prose `.vue` per file, rendered through the core (`@vow/markdown` → `emitProse`) — vow-native, not a
 * parallel doc-system. The content stays as markdown; the rendering is generated + dogfooded.
 */

/** A loaded Shiki highlighter (typed without a direct shiki import). */
type Highlighter = Awaited<ReturnType<typeof getHighlighter>>;

/** A top-nav link. */
export interface NavLink {
  readonly text: string;
  readonly link: string;
}

/** The docs chrome config — title + top-nav links, surfaced in the generated manifest. */
export interface DocsConfig {
  readonly title: string;
  readonly nav: readonly NavLink[];
}

export interface VowDocsOptions {
  /** Folder of plain `.md` content to render into prose pages. */
  readonly content: string;
  /** Where to write generated `.vue` (default ".generated", matching the vow app). */
  readonly outDir?: string;
  /** Section order for the sidebar (the page `group` frontmatter). Unlisted groups follow, A→Z. */
  readonly groups?: readonly string[];
  /** The site title shown in the top nav (links home). */
  readonly title?: string;
  /** Top-nav links. */
  readonly nav?: readonly NavLink[];
  /** A URL prefix for every page (e.g. "/guide"), so docs don't collide with the app's home. */
  readonly base?: string;
}

/** A page in the sidebar — its title and clean URL. */
export interface SidebarItem {
  readonly title: string;
  readonly path: string;
}

/** A sidebar section — a `group` and its ordered pages. */
export interface SidebarGroup {
  readonly title: string;
  readonly items: readonly SidebarItem[];
}

/** Options threaded into generation. */
export interface GenerateDocsOptions {
  readonly highlighter?: Highlighter;
  readonly groups?: readonly string[];
  readonly title?: string;
  readonly nav?: readonly NavLink[];
  readonly base?: string;
}

/** One scanned page's metadata, before it becomes a route + a sidebar entry. */
interface PageMeta {
  readonly path: string;
  readonly file: string;
  readonly group?: string;
  readonly order: number;
  readonly title: string;
}

/** Recursively collect every `.md` file under a directory. */
function mdFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...mdFilesUnder(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/** Split a leading YAML frontmatter block (flat `key: value` lines) from the markdown body. */
function parseFrontmatter(src: string): { data: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string> = {};
  for (const line of (m[1] ?? "").split("\n")) {
    const kv = /^(\w+):\s*(.+)$/.exec(line.trim());
    if (kv?.[1] !== undefined && kv[2] !== undefined) data[kv[1]] = kv[2].trim();
  }
  return { data, body: src.slice(m[0].length) };
}

/** The first `# heading` of a markdown body — the page title fallback. */
const firstH1 = (body: string): string | undefined => /^#\s+(.+)$/m.exec(body)?.[1]?.trim();

/** A content file's path under the root, `.md` stripped, forward-slashed (e.g. "guide/emit"). */
const relNoExt = (contentDir: string, file: string): string =>
  relative(contentDir, file).replace(/\.md$/, "").replace(/\\/g, "/");

/** A content file's generated slug — its path with `/` → `-`, `doc-` prefixed. */
export const docSlug = (contentDir: string, file: string): string =>
  `doc-${relNoExt(contentDir, file).replace(/\//g, "-")}`;

/** A content file's clean URL under `base` — `index` collapses to its folder ("guide/index" → "/guide"). */
export const routePath = (rel: string, base = ""): string => {
  const p = rel.replace(/(^|\/)index$/, "$1").replace(/\/$/, "");
  const segs = [base, p].flatMap((s) => s.split("/")).filter(Boolean);
  return `/${segs.join("/")}`;
};

/** Group the pages into ordered sidebar sections — `groups` first (in order), then any extras A→Z. */
export function buildSidebar(
  pages: readonly PageMeta[],
  groups: readonly string[] = [],
): SidebarGroup[] {
  const byGroup = new Map<string, PageMeta[]>();
  for (const p of pages) {
    if (p.group === undefined) continue; // ungrouped (e.g. the home page) is not in the sidebar
    byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), p]);
  }
  const order = [...groups, ...[...byGroup.keys()].filter((g) => !groups.includes(g)).sort()];
  return order
    .filter((g) => byGroup.has(g))
    .map((g) => ({
      title: g,
      items: [...(byGroup.get(g) ?? [])]
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
        .map((p) => ({ title: p.title, path: p.path })),
    }));
}

/** The generated manifest — `@vow/docs`'s routes (boot) + sidebar + chrome config (the layout). */
function manifestModule(
  pages: readonly PageMeta[],
  sidebar: readonly SidebarGroup[],
  config: DocsConfig,
): string {
  return [
    `// Generated docs manifest (from @vow/docs). The markdown is the source — do not edit.`,
    `import type { Route } from "@vow/router";`,
    `import type { DocsConfig, SidebarGroup } from "@vow/docs";`,
    ``,
    `export const routes: Route[] = [`,
    ...pages.map(
      (p) => `  { path: ${JSON.stringify(p.path)}, load: () => import("./${p.file}") },`,
    ),
    `];`,
    ``,
    `export const sidebar: SidebarGroup[] = ${JSON.stringify(sidebar, null, 2)};`,
    ``,
    `export const config: DocsConfig = ${JSON.stringify(config, null, 2)};`,
    ``,
  ].join("\n");
}

/**
 * Scan a content folder → a generated prose `.vue` per `.md` plus a manifest (routes + sidebar). The
 * sidebar is built from each page's `group`/`order`/`title` frontmatter. Returns the written paths.
 */
export function generateDocs(
  contentDir: string,
  outDir: string,
  opts: GenerateDocsOptions = {},
): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const pages: PageMeta[] = [];
  const used = new Set<string>(); // prose-component names referenced across the pages
  for (const file of mdFilesUnder(contentDir)) {
    const slug = docSlug(contentDir, file);
    const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
    const dir = dirname(file);
    const nodes = markdownToNodesSync(body, {
      highlighter: opts.highlighter,
      resolveSnippet: (p) => {
        try {
          return readFileSync(resolve(dir, p), "utf8");
        } catch {
          return null;
        }
      },
    });
    collectComponents(nodes, used);
    const out = join(outDir, `${slug}.vue`);
    writeFileSync(out, emitProse(slug, nodes), "utf8");
    written.push(out);
    const path = routePath(relNoExt(contentDir, file), opts.base);
    pages.push({
      path,
      file: `${slug}.vue`,
      group: data["group"],
      order: Number(data["order"] ?? 0),
      title: data["title"] ?? firstH1(body) ?? path,
    });
  }
  const config: DocsConfig = { title: opts.title ?? "Docs", nav: opts.nav ?? [] };
  const manifest = join(outDir, "vow-docs-routes.ts");
  writeFileSync(manifest, manifestModule(pages, buildSidebar(pages, opts.groups), config), "utf8");
  written.push(manifest);

  // The generated chrome: wires @vow/docs's Layout to the sidebar data. The boot picks it up via
  // import.meta.glob and passes it to the router as the layout around every page.
  const layout = join(outDir, "vow-docs-layout.vue");
  writeFileSync(layout, LAYOUT_SFC, "utf8");
  written.push(layout);

  // Materialise the prose-components the pages reference (CodeGroup, demos, …) into .generated so the
  // prose SFCs' `./<Name>.vue` imports resolve. Demos also write the generated primitive adapter they
  // import (via @vow/emit-primitive). Everything stays vow-native; the emit-* core is unchanged.
  const done = new Set<string>();
  const writeComp = (name: string, sfc: string): void => {
    if (done.has(name)) return;
    done.add(name);
    const file = join(outDir, `${name}.vue`);
    writeFileSync(file, sfc, "utf8");
    written.push(file);
  };
  for (const name of used) {
    if (PROSE_COMPONENTS[name] !== undefined) writeComp(name, PROSE_COMPONENTS[name]);
    const demo = DEMOS[name];
    if (demo !== undefined) {
      writeComp(demo.adapter, demo.emit()); // the generated primitive adapter
      writeComp(name, demo.sfc); // the live demo wrapper
    }
  }
  return written;
}

/** Collect every `<Component>` name referenced in a UiNode tree (structural — no core type import). */
function collectComponents(nodes: readonly unknown[], acc: Set<string>): void {
  for (const node of nodes) {
    const n = node as { kind?: string; name?: string; children?: unknown[] };
    if (n.kind === "component" && n.name !== undefined) acc.add(n.name);
    if (Array.isArray(n.children)) collectComponents(n.children, acc);
  }
}

/** The generated layout SFC — forwards the frontmatter-derived sidebar to @vow/docs's Layout. */
const LAYOUT_SFC = [
  `<script setup lang="ts">`,
  `import Layout from "@vow/docs/Layout.vue";`,
  `import { config, sidebar } from "./vow-docs-routes.ts";`,
  `import "@vow/docs/style.css";`,
  `defineProps<{ path: string }>();`,
  `</script>`,
  ``,
  `<template>`,
  `  <Layout :config="config" :groups="sidebar" :path="path"><slot /></Layout>`,
  `</template>`,
  ``,
].join("\n");

/** The CodeGroup component a `::: code-group` renders to — a tablist over its panels (the slot
    children, one per fence), showing the active one. Materialised into .generated when referenced. */
const CODE_GROUP_SFC = [
  `<script setup lang="ts">`,
  `import { type Component, computed, ref, useSlots } from "vue";`,
  `defineProps<{ labels: string[] }>();`,
  `const slots = useSlots();`,
  `const active = ref(0);`,
  `const panel = computed<Component>(() => () => slots.default?.()[active.value] ?? null);`,
  `</script>`,
  ``,
  `<template>`,
  `  <div class="vow-code-group">`,
  `    <div class="vow-code-group__tabs" role="tablist">`,
  `      <button`,
  `        v-for="(label, i) in labels"`,
  `        :key="i"`,
  `        type="button"`,
  `        role="tab"`,
  `        :aria-selected="i === active"`,
  `        class="vow-code-group__tab"`,
  `        :class="{ 'is-active': i === active }"`,
  `        @click="active = i"`,
  `      >`,
  `        {{ label }}`,
  `      </button>`,
  `    </div>`,
  `    <component :is="panel" />`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

/** Prose-components @vow/docs materialises into .generated when a page references them. */
const PROSE_COMPONENTS: Record<string, string> = { CodeGroup: CODE_GROUP_SFC };

/** Live primitive demos a `::: demo <X>` renders to — a wrapper around the generated adapter. */
const DEMO_CHECKBOX = `<script setup lang="ts">
import { ref } from "vue";
import Checkbox from "./Checkbox.vue";
const done = ref(false);
const subscribed = ref(true);
</script>

<template>
  <div class="vow-demo">
    <Checkbox v-model="done" label="Mark as done" />
    <Checkbox v-model="subscribed" label="Subscribe to updates" />
    <Checkbox :model-value="false" label="Locked (disabled)" disabled />
  </div>
</template>
`;

const DEMO_COLLAPSIBLE = `<script setup lang="ts">
import { ref } from "vue";
import Collapsible from "./Collapsible.vue";
const open = ref(true);
</script>

<template>
  <div class="vow-demo">
    <Collapsible v-model="open" label="What is a vow?">
      A vow is a promise the app makes — intent, shape, proof — and vow keeps it by generating
      type-safe code that a test holds to account.
    </Collapsible>
  </div>
</template>
`;

const DEMO_TABS = `<script setup lang="ts">
import { ref } from "vue";
import Tabs from "./Tabs.vue";
const active = ref("Vue");
const items = ["Vue", "React", "Solid"];
</script>

<template>
  <div class="vow-demo">
    <Tabs v-model="active" :items="items">
      <template #Vue>The Vue adapter ships today.</template>
      <template #React>The React adapter is on the roadmap.</template>
      <template #Solid>The Solid adapter is on the roadmap.</template>
    </Tabs>
  </div>
</template>
`;

const DEMO_DIALOG = `<script setup lang="ts">
import { ref } from "vue";
import Dialog from "./Dialog.vue";
const open = ref(false);
</script>

<template>
  <div class="vow-demo">
    <button type="button" class="vow-demo__trigger" @click="open = true">Open dialog</button>
    <Dialog v-model="open" title="A dialog">
      A modal dialog — focus is trapped, Esc or the close button dismisses it.
    </Dialog>
  </div>
</template>
`;

const DEMO_SELECT = `<script setup lang="ts">
import { ref } from "vue";
import Select from "./Select.vue";
const value = ref("todo");
const options = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];
</script>

<template>
  <div class="vow-demo">
    <Select v-model="value" :options="options" label="Status" />
  </div>
</template>
`;

/** A live demo: its wrapper SFC + the generated primitive adapter it imports. */
interface Demo {
  readonly sfc: string;
  readonly adapter: string;
  readonly emit: () => string;
}

/** `::: demo <X>` → the VowDemo<X> component; @vow/docs materialises the wrapper + the adapter. */
const DEMOS: Record<string, Demo> = {
  VowDemoCheckbox: { sfc: DEMO_CHECKBOX, adapter: "Checkbox", emit: emitCheckboxSfc },
  VowDemoCollapsible: { sfc: DEMO_COLLAPSIBLE, adapter: "Collapsible", emit: emitCollapsibleSfc },
  VowDemoTabs: { sfc: DEMO_TABS, adapter: "Tabs", emit: emitTabsSfc },
  VowDemoDialog: { sfc: DEMO_DIALOG, adapter: "Dialog", emit: emitDialogSfc },
  VowDemoSelect: { sfc: DEMO_SELECT, adapter: "Select", emit: emitSelectSfc },
};

/** A Vite plugin: scan `content` into generated prose pages; pre-warm Shiki once; reload on `.md` edit. */
export function vowDocs(options: VowDocsOptions): Plugin {
  const outOpt = options.outDir ?? ".generated";
  let contentDir = options.content;
  let genDir = outOpt;
  let highlighter: Highlighter | undefined;
  const regenerate = (): void => {
    generateDocs(contentDir, genDir, {
      highlighter,
      groups: options.groups,
      title: options.title,
      nav: options.nav,
      base: options.base,
    });
  };
  return {
    name: "vow:docs",
    async configResolved(config) {
      contentDir = isAbsolute(options.content)
        ? options.content
        : join(config.root, options.content);
      genDir = isAbsolute(outOpt) ? outOpt : join(config.root, outOpt);
      highlighter = await getHighlighter(); // pre-warm once, so generation stays sync
      regenerate();
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      const onChange = (file: string): void => {
        if (file.startsWith(contentDir) && file.endsWith(".md")) {
          regenerate();
          server.ws.send({ type: "full-reload" });
        }
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
