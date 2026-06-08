import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import {
  emitButtonSfc,
  emitCheckboxSfc,
  emitCollapsibleSfc,
  emitDialogSfc,
  emitFieldSfc,
  emitSelectSfc,
  emitSwitchSfc,
  emitTabsSfc,
  PRIMITIVE_ADAPTERS,
} from "@vow/emit-primitive";
import { emitProse } from "@vow/emit-view";
import { getHighlighter, markdownToNodesSync, type TocEntry } from "@vow/markdown";

export type { TocEntry } from "@vow/markdown";

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

/** The docs chrome config — title + top-nav links + the page base, surfaced in the generated manifest. */
export interface DocsConfig {
  readonly title: string;
  readonly nav: readonly NavLink[];
  /** The URL prefix doc pages live under (e.g. "/guide") — the layout uses it to tell docs from home. */
  readonly base: string;
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

/** A page in the sidebar — its title, clean URL, and any nested child pages. */
export interface SidebarItem {
  readonly title: string;
  readonly path: string;
  readonly items?: readonly SidebarItem[];
}

/** A sidebar section — a `group` and its ordered pages. */
export interface SidebarGroup {
  readonly title: string;
  readonly items: readonly SidebarItem[];
}

/** A searchable entry — a page title or a heading (with its parent page for context). */
export interface SearchItem {
  readonly label: string;
  readonly path: string;
  readonly section?: string;
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
const firstH1 = (body: string): string | undefined =>
  // strip fenced code (``` or ~~~) first, so a `# comment` inside a code block isn't taken as the title
  /^#\s+(.+)$/m.exec(body.replace(/(```|~~~)[\s\S]*?\1/g, ""))?.[1]?.trim();

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
      items: nestItems(
        [...(byGroup.get(g) ?? [])].sort(
          (a, b) => a.order - b.order || a.title.localeCompare(b.title),
        ),
      ),
    }));
}

/** Nest pages whose path is under another's, at any depth (e.g. `/guide/a/b/c` under `/guide/a/b`). */
function nestItems(pages: readonly PageMeta[]): SidebarItem[] {
  interface Node {
    title: string;
    path: string;
    order: number;
    items: Node[];
  }
  // shallowest paths first, so a page's parent is always already in the tree when we place it
  const byDepth = [...pages].sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  const deepestAncestor = (nodes: Node[], path: string): Node | undefined => {
    for (const node of nodes) {
      if (path.startsWith(`${node.path}/`)) return deepestAncestor(node.items, path) ?? node;
    }
    return undefined;
  };
  const roots: Node[] = [];
  for (const p of byDepth) {
    const node: Node = { title: p.title, path: p.path, order: p.order, items: [] };
    (deepestAncestor(roots, p.path)?.items ?? roots).push(node);
  }
  // depth-first sort restores the intended order/title order at every level
  const sortLevel = (nodes: Node[]): void => {
    nodes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    for (const node of nodes) sortLevel(node.items);
  };
  sortLevel(roots);
  const toItem = (n: Node): SidebarItem =>
    n.items.length > 0
      ? { title: n.title, path: n.path, items: n.items.map(toItem) }
      : { title: n.title, path: n.path };
  return roots.map(toItem);
}

/** The generated manifest — `@vow/docs`'s routes (boot) + sidebar + config + per-page TOC (the layout). */
function manifestModule(
  pages: readonly PageMeta[],
  sidebar: readonly SidebarGroup[],
  config: DocsConfig,
  tocByPath: Record<string, TocEntry[]>,
  search: readonly SearchItem[],
): string {
  return [
    `// Generated docs manifest (from @vow/docs). The markdown is the source — do not edit.`,
    `import type { Route } from "@vow/router";`,
    `import type { DocsConfig, SearchItem, SidebarGroup, TocEntry } from "@vow/docs";`,
    ``,
    `export const routes: Route[] = [`,
    ...pages.map(
      (p) =>
        `  { path: ${JSON.stringify(p.path)}, title: ${JSON.stringify(`${p.title} · ${config.title}`)}, load: () => import("./${p.file}") },`,
    ),
    `];`,
    ``,
    `export const sidebar: SidebarGroup[] = ${JSON.stringify(sidebar, null, 2)};`,
    ``,
    `export const config: DocsConfig = ${JSON.stringify(config, null, 2)};`,
    ``,
    `export const tocByPath: Record<string, TocEntry[]> = ${JSON.stringify(tocByPath, null, 2)};`,
    ``,
    `export const search: SearchItem[] = ${JSON.stringify(search, null, 2)};`,
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
  const tocByPath: Record<string, TocEntry[]> = {}; // "on this page" entries per route
  const search: SearchItem[] = []; // searchable entries (page titles + headings)
  const seenSlug = new Set<string>(); // guard: two files must not flatten to the same slug/file
  const seenPath = new Set<string>(); // guard: two pages must not map to the same route
  for (const file of mdFilesUnder(contentDir)) {
    const slug = docSlug(contentDir, file);
    if (seenSlug.has(slug)) {
      throw new Error(`@vow/docs: two content files map to the same generated file "${slug}.vue".`);
    }
    seenSlug.add(slug);
    const path = routePath(relNoExt(contentDir, file), opts.base);
    if (seenPath.has(path)) {
      throw new Error(`@vow/docs: two content files map to the same route "${path}".`);
    }
    seenPath.add(path);
    const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
    const dir = dirname(file);
    const toc: TocEntry[] = [];
    const nodes = markdownToNodesSync(body, {
      highlighter: opts.highlighter,
      toc,
      resolveSnippet: (p) => {
        // contain `<<<` includes to the content tree — no absolute paths, no `../` escaping it
        const full = resolve(dir, p);
        if (isAbsolute(p) || relative(contentDir, full).startsWith("..")) return null;
        try {
          return readFileSync(full, "utf8");
        } catch {
          return null;
        }
      },
    });
    collectComponents(nodes, used);
    const out = join(outDir, `${slug}.vue`);
    writeFileSync(out, emitProse(slug, nodes), "utf8");
    written.push(out);
    const title = data["title"] ?? firstH1(body) ?? path;
    tocByPath[path] = toc;
    search.push({ label: title, path });
    for (const heading of toc) {
      search.push({ label: heading.text, path: `${path}#${heading.slug}`, section: title });
    }
    pages.push({
      path,
      file: `${slug}.vue`,
      group: data["group"],
      order: Number(data["order"] ?? 0),
      title,
    });
  }
  const config: DocsConfig = {
    title: opts.title ?? "Docs",
    nav: opts.nav ?? [],
    base: opts.base ?? "",
  };
  const manifest = join(outDir, "vow-docs.routes.ts");
  writeFileSync(
    manifest,
    manifestModule(pages, buildSidebar(pages, opts.groups), config, tocByPath, search),
    "utf8",
  );
  written.push(manifest);

  // The generated chrome: wires @vow/docs's Layout to the sidebar data. The boot picks it up via
  // import.meta.glob and passes it to the router as the layout around every page.
  const layout = join(outDir, "vow-docs.layout.vue");
  writeFileSync(layout, `<!-- Generated by @vow/docs — do not edit. -->\n${LAYOUT_SFC}`, "utf8");
  written.push(layout);

  // Materialise the prose-components the pages reference (CodeGroup, demos, …) into .generated so the
  // prose SFCs' `./<Name>.vue` imports resolve. Demos also write the generated primitive adapter they
  // import (via @vow/emit-primitive). Everything stays vow-native; the emit-* core is unchanged.
  const done = new Set<string>();
  const banner = "<!-- Generated by @vow/docs — do not edit. -->\n";
  const writeComp = (name: string, sfc: string): void => {
    if (done.has(name)) return;
    done.add(name);
    const file = join(outDir, `${name}.vue`);
    writeFileSync(file, sfc.startsWith("<!--") ? sfc : banner + sfc, "utf8");
    written.push(file);
  };
  for (const name of used) {
    if (PROSE_COMPONENTS[name] !== undefined) writeComp(name, PROSE_COMPONENTS[name]);
    if (PRIMITIVES[name] !== undefined) writeComp(name, PRIMITIVES[name]()); // a primitive used in prose
    const demo = DEMOS[name];
    if (demo !== undefined) {
      writeComp(demo.adapter, demo.emit()); // the generated primitive adapter
      writeComp(name, demo.sfc); // the live demo wrapper
    }
  }
  // A referenced component with nothing to materialise would emit a prose SFC that imports a missing
  // file → a hard build failure. Fail loud here, naming the likely cause (an unknown `::: demo <x>`).
  const unknown = [...used].filter(
    (n) =>
      PROSE_COMPONENTS[n] === undefined && DEMOS[n] === undefined && PRIMITIVES[n] === undefined,
  );
  if (unknown.length > 0) {
    const demos = Object.keys(DEMOS)
      .map((d) => d.replace(/^VowDemo/, "").toLowerCase())
      .join(", ");
    throw new Error(
      `@vow/docs: no component to generate for ${unknown.join(", ")}. ` +
        `For "::: demo <primitive>", the known primitives are: ${demos}.`,
    );
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
  `import { config, search, sidebar, tocByPath } from "./vow-docs.routes.ts";`,
  `import "@vow/docs/style.css";`,
  `defineProps<{ path: string }>();`,
  `</script>`,
  ``,
  `<template>`,
  `  <Layout :config="config" :groups="sidebar" :toc-by-path="tocByPath" :search="search" :path="path"><slot /></Layout>`,
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

const DEMO_BUTTON = `<script setup lang="ts">
import Button from "./Button.vue";
</script>

<template>
  <div class="vow-demo">
    <Button label="Default" />
    <Button label="Outline" variant="outline" />
    <Button label="Ghost" variant="ghost" />
    <Button label="Small" size="sm" variant="outline" />
    <Button label="Large" size="lg" variant="outline" />
  </div>
</template>
`;

const DEMO_FIELD = `<script setup lang="ts">
import { ref } from "vue";
import Field from "./Field.vue";
const name = ref("");
</script>

<template>
  <div class="vow-demo">
    <Field label="Project name" control-id="demo-name" description="Shown across your dashboard.">
      <input id="demo-name" class="vow-input" v-model="name" placeholder="Acme Inc." />
    </Field>
    <Field label="Work email" control-id="demo-email" error="Enter a valid email address.">
      <input id="demo-email" class="vow-input" value="not-an-email" aria-invalid="true" aria-describedby="demo-email-error" />
    </Field>
  </div>
</template>
`;

const DEMO_SWITCH = `<script setup lang="ts">
import { ref } from "vue";
import Switch from "./Switch.vue";
const notifications = ref(true);
const sync = ref(false);
</script>

<template>
  <div class="vow-demo">
    <Switch v-model="notifications" label="Notifications" />
    <Switch v-model="sync" label="Background sync" />
    <Switch :model-value="false" label="Locked (disabled)" disabled />
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
  VowDemoButton: { sfc: DEMO_BUTTON, adapter: "Button", emit: emitButtonSfc },
  VowDemoCheckbox: { sfc: DEMO_CHECKBOX, adapter: "Checkbox", emit: emitCheckboxSfc },
  VowDemoCollapsible: { sfc: DEMO_COLLAPSIBLE, adapter: "Collapsible", emit: emitCollapsibleSfc },
  VowDemoTabs: { sfc: DEMO_TABS, adapter: "Tabs", emit: emitTabsSfc },
  VowDemoDialog: { sfc: DEMO_DIALOG, adapter: "Dialog", emit: emitDialogSfc },
  VowDemoField: { sfc: DEMO_FIELD, adapter: "Field", emit: emitFieldSfc },
  VowDemoSelect: { sfc: DEMO_SELECT, adapter: "Select", emit: emitSelectSfc },
  VowDemoSwitch: { sfc: DEMO_SWITCH, adapter: "Switch", emit: emitSwitchSfc },
};

/** Primitive adapters a page may reference directly — the closed registry from @vow/emit-primitive
 *  (one source of truth, shared with the `## view` vocabulary). A markdown task list (`- [x]`) renders
 *  <Checkbox>; prose can use any primitive by name. */
const PRIMITIVES = PRIMITIVE_ADAPTERS;

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
