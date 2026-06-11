import type { Attr, UiNode } from "./types.ts";
import { asObject, bound, objectExpr, quote, str } from "./helpers.ts";
import { defined } from "@vow/core";

/**
 * The slice/group plumbing a `## view` shares — the `sort`/`filter`/`group` attrs a sliced node carries,
 * the `defineProps` + `computed` setup lines that realise them, and the raw-prop→attr / children mapping
 * the layout + primitive nodes reuse. One place, so the list, cards and board all slice the same way.
 */

/** The `sort` / `filter` / `group` slice attrs for a sliced view node (`{ of, ..., sort?, filter? }`). */
export function sliceAttrs(obj: Readonly<Record<string, unknown>>): Attr[] {
  const attrs: Attr[] = [];
  if (defined(obj["sort"])) {
    attrs.push({ kind: "static", name: "sort", value: str(obj["sort"]) });
  }
  if (defined(obj["group"])) {
    attrs.push({ kind: "static", name: "group", value: str(obj["group"]) });
  }
  if (defined(obj["filter"])) {
    attrs.push(bound("filter", objectExpr(asObject(obj["filter"]))));
  }
  return attrs;
}

/**
 * Setup lines for a sliced collection — the `filter`/`sort`/`group` props + a `<name>` computed over
 * `rows` (filter by `{ field: value }`, then sort by a field). Shared by the list, cards and board.
 */
export function sliceComputed(type: string, name: string): string[] {
  return [
    `const props = defineProps<{ filter?: Record<string, unknown>; sort?: keyof ${type}; group?: keyof ${type} }>();`,
    `const ${name} = computed(() => {`,
    `  const f = props.filter;`,
    `  let r = f`,
    `    ? rows.filter((x) => Object.entries(f).every(([k, v]) => (x as Record<string, unknown>)[k] === v))`,
    `    : rows;`,
    `  const s = props.sort;`,
    `  if (s) {`,
    `    r = [...r].sort((a, b) => {`,
    `      const x = a[s];`,
    `      const y = b[s];`,
    `      if (typeof x === "number" && typeof y === "number") return x - y;`,
    `      return String(x).localeCompare(String(y));`,
    `    });`,
    `  }`,
    `  return r;`,
    `});`,
  ];
}

/**
 * Setup lines for `group-by` — a `grouped` computed that sections `${src}` by `props.group` (or one
 * unlabelled section when no group is set). Each section is `{ key: string | null, items }`.
 */
export function groupedLines(type: string, src: string): string[] {
  return [
    `const grouped = computed(() => {`,
    `  const g = props.group;`,
    `  if (!g) return [{ key: null as string | null, items: ${src}.value }];`,
    `  const m = new Map<string, ${type}[]>();`,
    `  for (const it of ${src}.value) {`,
    `    const k = String(it[g] ?? "");`,
    `    m.set(k, [...(m.get(k) ?? []), it]);`,
    `  }`,
    `  return [...m.entries()].map(([key, items]) => ({ key: key as string | null, items }));`,
    `});`,
  ];
}

/**
 * Map raw props (every key but `children`) to bound attrs: numbers stay numbers, else string literals.
 * The reserved `model:` key becomes a two-way binding (`v-model="<expr>"`) — its value is the expression.
 */
/** One prop entry (`name`, raw value) as a bound/model attr. */
function propToAttr(entry: readonly [string, unknown]): Attr {
  const [name, raw] = entry;
  if (name === "model") {
    return { expr: String(raw), kind: "model" };
  }
  if (typeof raw === "number") {
    return bound(name, String(raw));
  }
  return bound(name, `'${quote(String(raw))}'`);
}

export function propsToAttrs(value: Readonly<Record<string, unknown>>): Attr[] {
  return Object.entries(value)
    .filter((entry: readonly [string, unknown]) => entry[0] !== "children")
    .map((entry: readonly [string, unknown]) => propToAttr(entry));
}

/** Map a node's `children:` (raw single-key objects) to UiNodes via the caller's `toNode`. */
export function childrenOf(
  value: Readonly<Record<string, unknown>>,
  toNode: (raw: unknown) => UiNode,
): UiNode[] {
  const kids = value["children"];
  if (Array.isArray(kids)) {
    return kids.map((kid) => toNode(kid));
  }
  return [];
}
