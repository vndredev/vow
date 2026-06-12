import { FormSpec, Vow } from "./vow.ts";
import { asRecord, defined, isRecord, mapDefined } from "./guard.ts";
import { parse as parseYaml } from "yaml";

/** A fulfilment — derived from the `Vow` type so only the dual-exported `Vow`/`FormSpec` need importing. */
type Fulfillment = NonNullable<Vow["fulfills"]>;
/** A view node — the element type of a vow's `view`. */
type ViewNode = NonNullable<Vow["view"]>[number];
/** A form spec — the `Vow` form shape (the parsed `## form`). */
type FormSpecType = NonNullable<Vow["form"]>;
/** The validated Vow that `parseVowMd` returns. */
type VowNode = Vow;

/**
 * Parse a `<slug>.vow.md` — plain Markdown, no invented DSL:
 *   - YAML frontmatter for the non-prosaic truth (`id`, `fulfills`, `root`)
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

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/u;
const HEADING = /^#{1,6}\s/u;
const LIST_ITEM = /^-\s+(.+)$/u;
const INTENT = /^#\s+(.+)$/mu;
const TYPE_HEAD = /^(\w+\([^)]*\)|\w+)/u;
const OPEN_PAREN = /^\w+\(/u;
const SELECT_OPTS = /^select\((.+)\)$/u;
const REFERENCE_TARGET = /^reference\((.+)\)$/u;

/** A frontmatter record (an unknown-valued map) — the YAML head of a `.vow.md`. */
type Frontmatter = Record<string, unknown>;

/** The closed set of frontmatter keys — anything else is a typo, rejected with a did-you-mean hint. */
const KNOWN_KEYS: readonly string[] = ["fulfills", "id", "nav", "root", "shell", "title"];

/**
 * The known `## <section>` headings. Unlike the frontmatter (a closed contract), a `.vow.md` is plain
 * Markdown and may carry legitimate prose H2s — so a heading is rejected ONLY when it is a near-miss of
 * one of these, never for being merely unknown.
 */
const KNOWN_SECTIONS: readonly string[] = ["fields", "form", "proves", "seed", "view"];

/** The largest edit distance at which a typo is treated as a near-miss of a known name (not a stranger). */
const NEAR_MISS = 2;

/** A `## <heading>` line — the heading text is its first capture group. */
const H2 = /^##\s+(.+?)\s*$/u;

/** The shape `parseFieldLine` hands to `Vow.parse` — validated there, so the strings stay raw here. */
interface FieldDraft {
  readonly name: string;
  readonly options?: string[];
  readonly ref?: string;
  readonly required: boolean;
  readonly type: string;
}

/** The first capture group of `re` in `text`, or absent when it does not match. */
function firstGroup(re: Readonly<RegExp>, text: string): string | undefined {
  return re.exec(text)?.[1];
}

/** A string narrowed to its non-empty form — a blank collapses to absence (no `undefined` literal). */
function nonEmpty(text: string): string | undefined {
  return [text].find((value) => value !== "");
}

/** The trimmed `fulfills` frontmatter string, or absent (empty/non-string → a pure-composition vow). */
function fulfillsString(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return nonEmpty("");
  }
  return nonEmpty(raw.trim());
}

/** Parse a non-empty `fulfills` string into its discriminated fulfilment. */
function parseFulfillsText(text: string): Fulfillment {
  const parts = text.split(/\s+/u);
  const [kind] = parts;
  if (kind === "emit") {
    return { as: parts.slice(1).join(" "), kind: "emit" };
  }
  if (kind === "bind") {
    const [moduleName, exportName] = (parts[1] ?? "").split("#");
    return { export: exportName ?? "", kind: "bind", module: moduleName ?? "" };
  }
  throw new Error(
    `vow: unknown fulfilment "${text}" (expected "emit <as>" or "bind <module>#<export>")`,
  );
}

function parseFulfills(raw: unknown): Fulfillment | undefined {
  return mapDefined(fulfillsString(raw), (text) => parseFulfillsText(text));
}

/** The lines of `body` that fall under the `## <heading>` section (between it and the next heading). */
function linesUnder(body: string, heading: string): string[] {
  const headingRe = new RegExp(`^##\\s+${heading}\\s*$`, "iu");
  const lines = body.split("\n");
  const start = lines.findIndex((line) => headingRe.test(line));
  if (start === -1) {
    return [];
  }
  const after = lines.slice(start + 1);
  const end = after.findIndex((line) => HEADING.test(line));
  if (end === -1) {
    return after;
  }
  return after.slice(0, end);
}

/** Each `- …` item under a `## <heading>` section — the list body, trimmed, until the next heading. */
function itemsUnder(body: string, heading: string): string[] {
  return linesUnder(body, heading)
    .map((line) => firstGroup(LIST_ITEM, line.trim()))
    .filter((item) => defined(item))
    .map((item) => item.trim());
}

/** Split a `## fields` item into its name and the rest after the first colon. */
function splitFieldLine(item: string): { readonly name: string; readonly rest: string } {
  const colon = item.indexOf(":");
  if (colon === -1) {
    throw new Error(`vow: field "${item}" must be "<name>: <type>[, required]"`);
  }
  return { name: item.slice(0, colon).trim(), rest: item.slice(colon + 1).trim() };
}

/** Whether the modifiers trailing the type-head (after the head) contain the `required` flag. */
function hasRequired(rest: string, head: string): boolean {
  return rest
    .slice(head.length)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .includes("required");
}

/** The typed part of a field — `select(a|b)` → options, `reference(x)` → ref, anything else → the bare type. */
function typedPart(head: string): {
  readonly options?: string[];
  readonly ref?: string;
  readonly type: string;
} {
  const options = firstGroup(SELECT_OPTS, head);
  if (defined(options)) {
    return { options: options.split("|").map((opt) => opt.trim()), type: "select" };
  }
  const ref = firstGroup(REFERENCE_TARGET, head);
  if (defined(ref)) {
    return { ref: ref.trim(), type: "reference" };
  }
  return { type: head };
}

/**
 * Parse one `## fields` line:
 *   `title: text, required`        → { name, type: "text", required: true }
 *   `status: select(a|b|c)`        → { name, type: "select", options: ["a","b","c"] }
 *   `assignee: reference(user)`    → { name, type: "reference", ref: "user" }
 */
function parseFieldLine(item: string): FieldDraft {
  const { name, rest } = splitFieldLine(item);
  /*
   * The head is the type — possibly `select(a|b|c)` / `reference(entity)`, whose parens can hold
   * commas. Peel a balanced `type(...)` (or a bare `type`) BEFORE splitting the trailing `, required`,
   * so a comma inside the parens never strands the head on `select(a` and fails on the wrong path.
   */
  const head = firstGroup(TYPE_HEAD, rest) ?? "";
  if (OPEN_PAREN.test(rest) && !head.endsWith(")")) {
    throw new Error(`vow: field "${name}" has a malformed type "${rest}" — unbalanced parentheses`);
  }
  return { name, required: hasRequired(rest, head), ...typedPart(head) };
}

/** The body of a fenced ```yaml block under `## <heading>`, or absent when the section is missing. */
function sectionYaml(body: string, heading: string): string | undefined {
  const re = new RegExp(`##\\s+${heading}\\b[^\\n]*\\n+\`\`\`ya?ml\\n([\\s\\S]*?)\\n\`\`\``, "iu");
  return firstGroup(re, body);
}

/** One `## view` YAML item → a `ViewNode` (a single-key object: the component name + its raw value). */
function toViewNode(node: unknown): ViewNode {
  if (!isRecord(node)) {
    throw new TypeError(
      "vow: each `## view` item must be a single-key object, e.g. `- list: task`",
    );
  }
  const keys = Object.keys(node);
  const [type] = keys;
  if (keys.length !== 1 || !defined(type)) {
    throw new Error(
      `vow: a "## view" item must have exactly one component key (got ${keys.length})`,
    );
  }
  return { type, value: node[type] };
}

/**
 * Parse the `## view` section: a fenced ```yaml block of components. Each list item is a single-key
 * object — the key is the component (`hero`, `list`, `flex`, …), the value its raw content. Kept
 * UI-agnostic: core validates only the shape, the emitter interprets each component.
 */
function parseView(body: string): ViewNode[] | undefined {
  return mapDefined(sectionYaml(body, "view"), (yaml) => {
    const parsed: unknown = parseYaml(yaml);
    if (!Array.isArray(parsed)) {
      throw new TypeError(
        "vow: `## view` must be a YAML list of components (e.g. `- hero: {...}`)",
      );
    }
    return parsed.map((node) => toViewNode(node));
  });
}

/** Parse the `## form` section: a fenced ```yaml block (`of: <entity>`, `submit: <label>`). */
function parseForm(body: string): FormSpecType | undefined {
  return mapDefined(sectionYaml(body, "form"), (yaml) => {
    const spec = asRecord(parseYaml(yaml));
    return FormSpec.parse({ edit: spec["edit"], of: spec["of"], submit: spec["submit"] });
  });
}

/** Parse a `## seed` YAML block — sample records bootstrapped into the DB (once, if its table is empty). */
function parseSeed(body: string): Record<string, unknown>[] | undefined {
  return mapDefined(sectionYaml(body, "seed"), (yaml) => {
    const parsed: unknown = parseYaml(yaml);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((record) => isRecord(record));
  });
}

/** The frontmatter and body of a `.vow.md` — the YAML head split from the Markdown that follows it. */
function splitDocument(content: string): {
  readonly body: string;
  readonly frontmatter: Frontmatter;
} {
  const match = FRONTMATTER.exec(content);
  if (match === null) {
    return { body: content, frontmatter: {} };
  }
  return {
    body: content.slice(match[0].length),
    frontmatter: asRecord(parseYaml(match[1] ?? "")),
  };
}

/** A known name scored by its edit distance to a typo — the rows ranked by `nearestKnown`. */
interface Scored {
  readonly candidate: string;
  readonly distance: number;
}

/** The Levenshtein edit distance between `from` and `into` — insertions, deletions, substitutions. */
function editDistance(from: string, into: string): number {
  let prev = Array.from({ length: into.length + 1 }, (_unused, index) => index);
  for (let row = 0; row < from.length; row += 1) {
    const next = [row + 1];
    for (let col = 0; col < into.length; col += 1) {
      const substitute = (prev[col] ?? 0) + Number(from[row] !== into[col]);
      next.push(Math.min(substitute, (prev[col + 1] ?? 0) + 1, (next[col] ?? 0) + 1));
    }
    prev = next;
  }
  return prev[into.length] ?? 0;
}

/** The known name a typo is closest to within `NEAR_MISS` — or absent when it is a stranger, not a typo. */
function nearestKnown(word: string, known: readonly string[]): string | undefined {
  const ranked: readonly Scored[] = known
    .map((candidate) => ({ candidate, distance: editDistance(word, candidate) }))
    .filter((scored: Readonly<Scored>) => scored.distance > 0 && scored.distance <= NEAR_MISS)
    .toSorted((left: Scored, right: Scored) => left.distance - right.distance);
  return ranked[0]?.candidate;
}

/** The keys of `frontmatter` that fall outside the closed `KNOWN_KEYS` contract. */
function unknownKeys(frontmatter: Readonly<Frontmatter>): string[] {
  return Object.keys(frontmatter).filter((key) => !KNOWN_KEYS.includes(key));
}

/** Reject any frontmatter key outside the closed set — a typo'd key is silent-data-loss otherwise. */
function assertKnownKeys(frontmatter: Readonly<Frontmatter>): void {
  const [stray] = unknownKeys(frontmatter);
  if (!defined(stray)) {
    return;
  }
  const hint = mapDefined(nearestKnown(stray, KNOWN_KEYS), (near) => ` (did you mean "${near}"?)`);
  throw new Error(`vow: unknown frontmatter key "${stray}"${hint ?? ""}`);
}

/** The `## <heading>` texts in `body`, lower-cased — every H2, prose included. */
function headings(body: string): string[] {
  return body
    .split("\n")
    .map((line) => firstGroup(H2, line)?.toLowerCase())
    .filter((heading): heading is string => defined(heading));
}

/**
 * Reject a `## <heading>` that is a NEAR-MISS of a known section (`fileds`, `prove`, `veiw`). A plain
 * unknown H2 is legitimate prose and passes untouched — only a typo of a real section heading errors.
 */
function assertNoMistypedSections(body: string): void {
  const mistyped = headings(body)
    .filter((heading) => !KNOWN_SECTIONS.includes(heading))
    .map((heading) => ({ heading, near: nearestKnown(heading, KNOWN_SECTIONS) }))
    .find((scored: Readonly<{ heading: string; near: string | undefined }>) =>
      defined(scored.near),
    );
  if (defined(mistyped) && defined(mistyped.near)) {
    throw new Error(
      `vow: unknown section heading "## ${mistyped.heading}" (did you mean "## ${mistyped.near}"?)`,
    );
  }
}

/** Parse one `<slug>.vow.md` into a validated Vow. `slug` is supplied by the loader (the filename). */
export function parseVowMd(slug: string, content: string): VowNode {
  const { body, frontmatter } = splitDocument(content);
  assertKnownKeys(frontmatter);
  assertNoMistypedSections(body);
  const intent = firstGroup(INTENT, body)?.trim() ?? "";
  return Vow.parse({
    fields: itemsUnder(body, "fields").map((item) => parseFieldLine(item)),
    form: parseForm(body),
    fulfills: parseFulfills(frontmatter["fulfills"]),
    id: frontmatter["id"],
    intent,
    nav: frontmatter["nav"],
    proof: itemsUnder(body, "proves").map((claim) => ({ claim })),
    root: frontmatter["root"],
    seed: parseSeed(body),
    shell: frontmatter["shell"],
    slug,
    title: frontmatter["title"],
    view: parseView(body),
  });
}
