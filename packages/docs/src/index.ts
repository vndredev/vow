import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import {
  emitBadgeSfc,
  emitButtonSfc,
  emitCalloutSfc,
  emitCardBodySfc,
  emitCardHeaderSfc,
  emitCardSfc,
  emitCheckboxSfc,
  emitCollapsibleSfc,
  emitDialogSfc,
  emitFieldSfc,
  emitRadioGroupSfc,
  emitSelectSfc,
  emitStatSfc,
  emitStatsSfc,
  emitSwitchSfc,
  emitTableCellSfc,
  emitTableHeadSfc,
  emitTableRowSfc,
  emitTableSfc,
  emitTabsSfc,
  PRIMITIVE_ADAPTERS,
} from "@vow/emit-primitive";
import { emitProse, emitTimelineSfc } from "@vow/emit-view";
import { getHighlighter, markdownToNodesSync, type TocEntry } from "@vow/markdown";
import { gitRemoteUrl, gitTimeline } from "@vow/observability";

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
  /** One-line site summary for the generated `llms.txt` header. */
  readonly description?: string;
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
  /** One-line site summary for the `llms.txt` header. */
  readonly description?: string;
  /** Where to write `llms.txt` + `llms-full.txt` (the served `public/` dir). Skipped if unset. */
  readonly publicDir?: string;
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

/** One page's content, gathered during the scan for the llms.txt build. */
export interface LlmsEntry {
  readonly title: string;
  readonly path: string;
  readonly group?: string;
  readonly order: number;
  readonly body: string;
}

/** The first real sentence of a markdown body — a one-line description for the llms.txt index. */
function firstSentence(body: string): string {
  const para = body
    .split("\n\n")
    .map((p) => p.trim())
    .find((p) => p !== "" && !/^[#:`>|-]/.test(p));
  if (para === undefined) return "";
  const text = para
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\n/g, " ");
  const dot = text.indexOf(". ");
  return (dot === -1 ? text : text.slice(0, dot + 1)).trim();
}

/** Strip doc-only blocks (the whole live `::: demo … :::` placeholder) — no text for an LLM reader. */
const cleanBody = (body: string): string =>
  body
    .replace(/^::: ?(?:demo|timeline)\b[\s\S]*?\n:::[ \t]*$/gm, "")
    .replace(/:badge\[([^\]]+)\](?:\{[^}]*\})?/g, "$1") // an inline badge → its label
    .replace(/:icon\[[^\]]+\]\s?/g, "") // an inline icon → dropped (it's decorative)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Build the `llms.txt` pair from the scanned pages — the [llmstxt.org](https://llmstxt.org) convention:
 * `index` is a curated map (title + grouped links + one-line descriptions); `full` inlines every page's
 * markdown, so an LLM loads the whole documentation in one request. vow-native — the same dogfooding
 * `vitepress-plugin-llms` does for VitePress, here generated by our own docs pipeline (no VitePress).
 */
export function buildLlms(
  entries: readonly LlmsEntry[],
  meta: { title: string; description?: string },
  groups: readonly string[] = [],
): { index: string; full: string } {
  const byGroup = new Map<string, LlmsEntry[]>();
  for (const e of entries) {
    if (e.group === undefined) continue;
    byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e]);
  }
  const order = [...groups, ...[...byGroup.keys()].filter((g) => !groups.includes(g)).sort()];
  // by order, then by path — so a parent page (a path prefix, e.g. /primitives) precedes its children
  const inOrder = (ps: LlmsEntry[]): LlmsEntry[] =>
    [...ps].sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));

  const index = [`# ${meta.title}`, ""];
  if (meta.description !== undefined) index.push(`> ${meta.description}`, "");
  const full = [`# ${meta.title} — full documentation`, ""];
  if (meta.description !== undefined) full.push(`> ${meta.description}`, "");

  for (const g of order) {
    const ps = byGroup.get(g);
    if (ps === undefined) continue;
    index.push(`## ${g}`);
    for (const p of inOrder(ps)) {
      const desc = firstSentence(p.body);
      index.push(`- [${p.title}](${p.path})${desc === "" ? "" : `: ${desc}`}`);
      full.push("---", "", `> Source: ${p.path}`, "", cleanBody(p.body), "");
    }
    index.push("");
  }
  return { index: `${index.join("\n").trimEnd()}\n`, full: `${full.join("\n").trimEnd()}\n` };
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
  const llmsEntries: LlmsEntry[] = []; // page content for the llms.txt build
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
    llmsEntries.push({
      title,
      path,
      group: data["group"],
      order: Number(data["order"] ?? 0),
      body,
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

  // llms.txt — the docs in LLM-readable form (the convention: an index + a full single-file dump),
  // written to the served `public/` dir so it ships at /llms.txt + /llms-full.txt. vow eats its own
  // dog food: a generator describing a vow app for LLMs, generated by the vow app itself.
  if (opts.publicDir !== undefined) {
    mkdirSync(opts.publicDir, { recursive: true });
    const llms = buildLlms(
      llmsEntries,
      { title: config.title, description: opts.description },
      opts.groups,
    );
    const llmsIndex = join(opts.publicDir, "llms.txt");
    const llmsFull = join(opts.publicDir, "llms-full.txt");
    writeFileSync(llmsIndex, llms.index, "utf8");
    writeFileSync(llmsFull, llms.full, "utf8");
    written.push(llmsIndex, llmsFull);
  }

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
    if (name === "VowTimeline") {
      for (const dep of ["Badge", "Collapsible"]) {
        const adapter = PRIMITIVES[dep]; // the timeline's type chips + per-date collapse
        if (adapter !== undefined) writeComp(dep, adapter());
      }
      writeComp(name, emitTimelineSfc(gitTimeline(contentDir), gitRemoteUrl(contentDir)));
    }
    const demo = DEMOS[name];
    if (demo !== undefined) {
      writeComp(demo.adapter, demo.emit()); // the generated primitive adapter
      for (const part of demo.also ?? []) writeComp(part.name, part.emit()); // composed: its other parts
      writeComp(name, demo.sfc); // the live demo wrapper
    }
  }
  // A referenced component with nothing to materialise would emit a prose SFC that imports a missing
  // file → a hard build failure. Fail loud here, naming the likely cause (an unknown `::: demo <x>`).
  const unknown = [...used].filter(
    (n) =>
      n !== "Icon" && // imported from @vow/icons (a package), not materialised into .generated
      n !== "VowTimeline" && // materialised above from the git-derived timeline
      PROSE_COMPONENTS[n] === undefined &&
      DEMOS[n] === undefined &&
      PRIMITIVES[n] === undefined,
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
    <div class="vow-demo__row">
      <Button label="Default" />
      <Button label="Outline" variant="outline" />
      <Button label="Ghost" variant="ghost" />
    </div>
    <div class="vow-demo__row">
      <Button label="Small" size="sm" />
      <Button label="Default" />
      <Button label="Large" size="lg" />
    </div>
    <div class="vow-demo__row">
      <Button label="Add task" icon="plus" />
      <Button label="Edit" icon="pencil" variant="outline" />
      <Button label="Delete" icon="trash" variant="ghost" />
    </div>
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

const DEMO_RADIO = `<script setup lang="ts">
import { ref } from "vue";
import RadioGroup from "./RadioGroup.vue";
const status = ref("doing");
const options = ["todo", "doing", "done"];
</script>

<template>
  <div class="vow-demo">
    <RadioGroup v-model="status" :options="options" label="Status" />
  </div>
</template>
`;

const DEMO_BADGE = `<script setup lang="ts">
import Badge from "./Badge.vue";
</script>

<template>
  <div class="vow-demo">
    <div class="vow-demo__row">
      <Badge label="Backlog" />
      <Badge label="In review" variant="accent" />
      <Badge label="Done" variant="success" icon="check" />
      <Badge label="At risk" variant="warning" />
      <Badge label="Blocked" variant="danger" icon="x" />
    </div>
  </div>
</template>
`;

const DEMO_TABLE = `<script setup lang="ts">
import Table from "./Table.vue";
import TableRow from "./TableRow.vue";
import TableHead from "./TableHead.vue";
import TableCell from "./TableCell.vue";
import Badge from "./Badge.vue";
const rows = [
  { task: "Fix the login flow", status: "blocked", variant: "warning" },
  { task: "Ship the timeline", status: "done", variant: "success" },
  { task: "Draft the board", status: "todo", variant: "neutral" },
];
</script>

<template>
  <div class="vow-demo">
    <Table>
      <thead>
        <TableRow>
          <TableHead scope="col">Task</TableHead>
          <TableHead scope="col">Status</TableHead>
        </TableRow>
      </thead>
      <tbody>
        <TableRow v-for="r in rows" :key="r.task">
          <TableCell>{{ r.task }}</TableCell>
          <TableCell><Badge :label="r.status" :variant="r.variant" /></TableCell>
        </TableRow>
      </tbody>
    </Table>
  </div>
</template>
`;

const DEMO_CARD = `<script setup lang="ts">
import Card from "./Card.vue";
import CardHeader from "./CardHeader.vue";
import CardBody from "./CardBody.vue";
import Badge from "./Badge.vue";
</script>

<template>
  <div class="vow-demo">
    <Card>
      <CardHeader>
        Fix the login flow
        <Badge label="blocked" variant="warning" />
      </CardHeader>
      <CardBody>A user can't sign in after the redirect — the session is dropped.</CardBody>
    </Card>
  </div>
</template>
`;

const DEMO_STATS = `<script setup lang="ts">
import Stats from "./Stats.vue";
import Stat from "./Stat.vue";
</script>

<template>
  <div class="vow-demo">
    <Stats>
      <Stat :value="12" label="Open" />
      <Stat :value="34" label="Done" />
      <Stat :value="3" label="Blocked" />
    </Stats>
  </div>
</template>
`;

const DEMO_CALLOUT = `<script setup lang="ts">
import Callout from "./Callout.vue";
</script>

<template>
  <div class="vow-demo">
    <Callout variant="tip" title="Tip">A table is just composable parts — compose what you need.</Callout>
    <Callout variant="warning" title="Heads up">The board writes a drag straight back to the vow.</Callout>
  </div>
</template>
`;

/** A live demo: its wrapper SFC + the generated primitive adapter it imports (`also` = extra parts a
 *  composed primitive needs, e.g. a Card demo materialises Card + CardHeader + CardBody). */
interface Demo {
  readonly sfc: string;
  readonly adapter: string;
  readonly emit: () => string;
  readonly also?: readonly { readonly name: string; readonly emit: () => string }[];
}

/** `::: demo <X>` → the VowDemo<X> component; @vow/docs materialises the wrapper + the adapter. */
const DEMOS: Record<string, Demo> = {
  VowDemoBadge: { sfc: DEMO_BADGE, adapter: "Badge", emit: emitBadgeSfc },
  VowDemoButton: { sfc: DEMO_BUTTON, adapter: "Button", emit: emitButtonSfc },
  VowDemoCallout: { sfc: DEMO_CALLOUT, adapter: "Callout", emit: emitCalloutSfc },
  VowDemoCard: {
    sfc: DEMO_CARD,
    adapter: "Card",
    emit: emitCardSfc,
    also: [
      { name: "CardHeader", emit: emitCardHeaderSfc },
      { name: "CardBody", emit: emitCardBodySfc },
      { name: "Badge", emit: emitBadgeSfc },
    ],
  },
  VowDemoStats: {
    sfc: DEMO_STATS,
    adapter: "Stats",
    emit: emitStatsSfc,
    also: [{ name: "Stat", emit: emitStatSfc }],
  },
  VowDemoTable: {
    sfc: DEMO_TABLE,
    adapter: "Table",
    emit: emitTableSfc,
    also: [
      { name: "TableRow", emit: emitTableRowSfc },
      { name: "TableHead", emit: emitTableHeadSfc },
      { name: "TableCell", emit: emitTableCellSfc },
      { name: "Badge", emit: emitBadgeSfc },
    ],
  },
  VowDemoCheckbox: { sfc: DEMO_CHECKBOX, adapter: "Checkbox", emit: emitCheckboxSfc },
  VowDemoCollapsible: { sfc: DEMO_COLLAPSIBLE, adapter: "Collapsible", emit: emitCollapsibleSfc },
  VowDemoTabs: { sfc: DEMO_TABS, adapter: "Tabs", emit: emitTabsSfc },
  VowDemoDialog: { sfc: DEMO_DIALOG, adapter: "Dialog", emit: emitDialogSfc },
  VowDemoField: { sfc: DEMO_FIELD, adapter: "Field", emit: emitFieldSfc },
  VowDemoRadio: { sfc: DEMO_RADIO, adapter: "RadioGroup", emit: emitRadioGroupSfc },
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
  let publicDir: string | undefined;
  let highlighter: Highlighter | undefined;
  const regenerate = (): void => {
    generateDocs(contentDir, genDir, {
      highlighter,
      groups: options.groups,
      title: options.title,
      nav: options.nav,
      base: options.base,
      description: options.description,
      publicDir,
    });
  };
  return {
    name: "vow:docs",
    async configResolved(config) {
      contentDir = isAbsolute(options.content)
        ? options.content
        : join(config.root, options.content);
      genDir = isAbsolute(outOpt) ? outOpt : join(config.root, outOpt);
      publicDir = config.publicDir === "" ? join(config.root, "public") : config.publicDir;
      highlighter = await getHighlighter(); // pre-warm once, so generation stays sync
      try {
        regenerate();
      } catch (err) {
        config.logger.error(`[vow:docs] generation failed: ${(err as Error).message}`);
      }
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      const onChange = (file: string): void => {
        if (!file.startsWith(contentDir) || !file.endsWith(".md")) return;
        try {
          regenerate();
          server.ws.send({ type: "full-reload" });
        } catch (err) {
          // a bad save mid-edit must NOT crash the dev server — show it in the Vite error overlay and
          // keep serving the last good docs; the next valid save clears it.
          const e = err as Error;
          server.config.logger.error(`[vow:docs] generation failed: ${e.message}`);
          server.ws.send({ type: "error", err: { message: e.message, stack: e.stack ?? "" } });
        }
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
