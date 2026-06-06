import { parse as parseYaml } from "yaml";
import { Vow, type Fulfillment, type Vow as VowNode } from "./vow.ts";

/**
 * Parse a `<slug>.vow.md` — plain Markdown, no invented DSL:
 *   - YAML frontmatter for the non-prosaic truth (`id`, `fulfills`, `kind`)
 *   - `# …`        → the intent (the promise)
 *   - `## fields`  → the data shape (for `emit entity`): `- <name>: <type>[, required]`
 *   - `## proves`  → the proof scenarios (one per list item)
 *   - `## tree`    → a view's layout (indented `- Name(prop=value)` nodes; indentation = nesting)
 *   - the slug comes from the filename, not the file content
 *
 * `fulfills` uses a compact value convention (still standard YAML strings, trivial to read/write):
 *   `emit vue`              → { kind: "emit", as: "vue" }
 *   `emit entity`           → { kind: "emit", as: "entity" }
 *   `bind @vow/core#rollup` → { kind: "bind", module: "@vow/core", export: "rollup" }
 */

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;

function parseFulfills(raw: unknown): Fulfillment | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const parts = raw.trim().split(/\s+/);
  const kind = parts[0];
  if (kind === "emit") return { kind: "emit", as: parts.slice(1).join(" ") };
  if (kind === "bind") {
    const [moduleName, exportName] = (parts[1] ?? "").split("#");
    return { kind: "bind", module: moduleName ?? "", export: exportName ?? "" };
  }
  throw new Error(
    `vow: unknown fulfilment "${raw}" (expected "emit <as>" or "bind <module>#<export>")`,
  );
}

/** Yield each `- …` item under a `## <heading>` section, until the next heading or EOF. */
function* itemsUnder(body: string, heading: string): Generator<string> {
  const headingRe = new RegExp(`^##\\s+${heading}\\s*$`, "i");
  let active = false;
  for (const line of body.split("\n")) {
    if (headingRe.test(line)) {
      active = true;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      active = false;
      continue;
    }
    const item = /^-\s+(.+)$/.exec(line.trim());
    if (active && item?.[1]) yield item[1].trim();
  }
}

/**
 * Parse one `## fields` line:
 *   `title: text, required`        → { name, type: "text", required: true }
 *   `status: select(a|b|c)`        → { name, type: "select", options: ["a","b","c"] }
 */
function parseFieldLine(item: string): {
  name: string;
  type: string;
  required: boolean;
  options?: string[];
} {
  const colon = item.indexOf(":");
  if (colon < 0) {
    throw new Error(`vow: field "${item}" must be "<name>: <type>[, required]"`);
  }
  const name = item.slice(0, colon).trim();
  const attrs = item
    .slice(colon + 1)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const required = attrs.slice(1).includes("required");
  const select = /^select\((.+)\)$/.exec(attrs[0] ?? "");
  if (select?.[1]) {
    return { name, type: "select", required, options: select[1].split("|").map((o) => o.trim()) };
  }
  return { name, type: attrs[0] ?? "", required };
}

/** Parse a `Name(prop=value, ...)` tree head into a component name + raw string props. */
function parseTreeHead(head: string): { component: string; props: Record<string, string> } {
  const m = /^([A-Za-z][A-Za-z0-9]*)\s*(?:\(([^)]*)\))?$/.exec(head);
  if (!m?.[1]) {
    throw new Error(`vow: tree node "${head}" must be "Name" or "Name(prop=value, ...)"`);
  }
  const props: Record<string, string> = {};
  const inner = m[2]?.trim();
  if (inner) {
    for (const pair of inner.split(",")) {
      const eq = pair.indexOf("=");
      if (eq < 0) throw new Error(`vow: tree prop "${pair.trim()}" must be "name=value"`);
      props[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
  }
  return { component: m[1], props };
}

interface MutableTree {
  component: string;
  props: Record<string, string>;
  children: MutableTree[];
}

/**
 * Parse the `## tree` section into a single-root tree. Unlike `itemsUnder`, indentation is kept:
 * the leading-space count sets nesting (a deeper item is a child of the nearest shallower one).
 */
function parseTree(body: string): MutableTree | undefined {
  const lines: string[] = [];
  let active = false;
  for (const line of body.split("\n")) {
    if (/^##\s+tree\s*$/i.test(line)) {
      active = true;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      active = false;
      continue;
    }
    if (active && /^\s*-\s+\S/.test(line)) lines.push(line);
  }
  if (lines.length === 0) return undefined;

  const roots: MutableTree[] = [];
  const stack: { node: MutableTree; indent: number }[] = [];
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    const head = /^-\s+(.+?)\s*$/.exec(line.trim());
    if (!head?.[1]) continue;
    const node: MutableTree = { ...parseTreeHead(head[1]), children: [] };
    while (stack.length > 0 && (stack.at(-1)?.indent ?? -1) >= indent) stack.pop();
    const parent = stack.at(-1);
    if (parent) parent.node.children.push(node);
    else roots.push(node);
    stack.push({ node, indent });
  }
  if (roots.length !== 1) {
    throw new Error(`vow: a ## tree must have exactly one root node (found ${roots.length})`);
  }
  return roots[0];
}

/** Parse one `<slug>.vow.md` into a validated Vow. `slug` is supplied by the loader (the filename). */
export function parseVowMd(slug: string, content: string): VowNode {
  const fm = FRONTMATTER.exec(content);
  const frontmatter = (fm ? parseYaml(fm[1] ?? "") : {}) as Record<string, unknown>;
  const body = fm ? content.slice(fm[0].length) : content;
  const intent = /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? "";
  return Vow.parse({
    id: frontmatter["id"],
    slug,
    intent,
    kind: frontmatter["kind"],
    of: frontmatter["of"],
    fulfills: parseFulfills(frontmatter["fulfills"]),
    fields: [...itemsUnder(body, "fields")].map(parseFieldLine),
    proof: [...itemsUnder(body, "proves")].map((claim) => ({ claim })),
    tree: parseTree(body),
  });
}
