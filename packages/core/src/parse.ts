import { parse as parseYaml } from "yaml";
import { Vow, type Fulfillment, type ViewNode, type Vow as VowNode } from "./vow.ts";

/**
 * Parse a `<slug>.vow.md` — plain Markdown, no invented DSL:
 *   - YAML frontmatter for the non-prosaic truth (`id`, `fulfills`, `kind`)
 *   - `# …`        → the intent (the promise)
 *   - `## fields`  → the data shape (for `emit entity`): `- <name>: <type>[, required]`
 *   - `## proves`  → the proof scenarios (one per list item)
 *   - `## view`    → a view as YAML: a list of components (`- hero: {…}`, `- list: task`, `- flex: {…}`)
 *   - the slug comes from the filename, not the file content
 *
 * `fulfills` uses a compact value convention (still standard YAML strings, trivial to read/write):
 *   `emit entity`           → { kind: "emit", as: "entity" }
 *   `emit view`             → { kind: "emit", as: "view" }
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

/**
 * Parse the `## view` section: a fenced ```yaml block of components. Each list item is a single-key
 * object — the key is the component (`hero`, `list`, `flex`, …), the value its raw content. Kept
 * UI-agnostic: core validates only the shape, the emitter interprets each component.
 */
function parseView(body: string): ViewNode[] | undefined {
  const m = /##\s+view\b[^\n]*\n+```ya?ml\n([\s\S]*?)\n```/i.exec(body);
  if (!m?.[1]) return undefined;
  const parsed: unknown = parseYaml(m[1]);
  if (!Array.isArray(parsed)) {
    throw new Error("vow: `## view` must be a YAML list of components (e.g. `- hero: {...}`)");
  }
  return parsed.map((node): ViewNode => {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      throw new Error("vow: each `## view` item must be a single-key object, e.g. `- list: task`");
    }
    const keys = Object.keys(node);
    if (keys.length !== 1 || keys[0] === undefined) {
      throw new Error(
        `vow: a "## view" item must have exactly one component key (got ${keys.length})`,
      );
    }
    const type = keys[0];
    return { type, value: (node as Record<string, unknown>)[type] };
  });
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
    view: parseView(body),
    root: frontmatter["root"],
  });
}
