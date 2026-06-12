import type { DeepReadonly, ReadonlyField, ReadonlyVow } from "./readonly.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { SUFFIX } from "./load.ts";
import type { ViewNode } from "./vow.ts";
import { defined } from "./guard.ts";
import path from "node:path";
import { stringify } from "yaml";

/**
 * Serialize a Vow back to its `<slug>.vow.md` source — the exact inverse of `parseVowMd`. The contract:
 * `parseVowMd(v.slug, serialize(v))` deep-equals `v` (minus `children`, which live in a sibling folder).
 * `nav`/`shell` render as flow YAML to match hand-written files; the body's `## view`/`## form`/`## seed`
 * re-stringify YAML, which round-trips **by value** (the gate compares parsed Vows, not bytes). This is
 * the write half of the author layer — the MCP mutates a loaded tree, `writeVow` saves it, the dev
 * watcher regenerates.
 */

/** A compact flow-YAML object (`{ a: b, c: d }`) for a frontmatter value (nav · shell). */
function flow(obj: unknown): string {
  return stringify(obj, { collectionStyle: "flow" }).trim();
}

/** The inverse of `parseFulfills` — `emit <as>` / `bind <module>#<export>`. */
function serializeFulfills(fulfills: NonNullable<ReadonlyVow["fulfills"]>): string {
  if (fulfills.kind === "emit") {
    return `emit ${fulfills.as}`;
  }
  return `bind ${fulfills.module}#${fulfills.export}`;
}

/** The type-head of a field line — `select(a|b)` / `reference(x)` / a bare type. */
function fieldHead(field: ReadonlyField): string {
  if (field.type === "select") {
    return `select(${(field.options ?? []).join("|")})`;
  }
  if (field.type === "reference") {
    return `reference(${field.ref ?? ""})`;
  }
  return field.type;
}

/** One `## fields` line — the inverse of `parseFieldLine`. */
function serializeField(field: ReadonlyField): string {
  const head = fieldHead(field);
  let flag = "";
  if (field.required) {
    flag = ", required";
  }
  return `- ${field.name}: ${head}${flag}`;
}

/** A `## <heading>` with a fenced ```yaml block. */
function yamlBlock(heading: string, value: unknown): string {
  return `## ${heading}\n\n\`\`\`yaml\n${stringify(value).trimEnd()}\n\`\`\``;
}

/** One view node as its single-key YAML object (`{ [type]: value }`). */
function viewEntry(node: DeepReadonly<ViewNode>): Record<string, unknown> {
  return { [node.type]: node.value };
}

/** The form block (`of`/`edit` included only when set — a singleton editor carries `edit: true`). */
function formBlock(form: NonNullable<ReadonlyVow["form"]>): string {
  const fields: Record<string, unknown> = {};
  if (defined(form.of)) {
    fields["of"] = form.of;
  }
  fields["submit"] = form.submit;
  if (form.edit === true) {
    fields["edit"] = true;
  }
  return yamlBlock("form", fields);
}

/** A section spread into the line list only when `include` holds — `[text()]` or `[]`, no ternary/undefined. */
function when(include: boolean, text: () => string): string[] {
  if (include) {
    return [text()];
  }
  return [];
}

/** As `when`, but for an optional value — the section renders (with the narrowed value) only when present. */
function whenSet<T>(value: T | undefined, text: (set: T) => string): string[] {
  if (defined(value)) {
    return [text(value)];
  }
  return [];
}

/** The frontmatter lines — id, then fulfilment/root/title/nav/shell when each is set. */
function frontmatterLines(vow: ReadonlyVow): string[] {
  return [
    `id: ${vow.id}`,
    ...whenSet(vow.fulfills, (fulfills) => `fulfills: ${serializeFulfills(fulfills)}`),
    ...when(vow.root === true, () => `root: true`),
    // Quotes the title only if YAML needs them.
    ...whenSet(vow.title, (title) => stringify({ title }).trim()),
    ...whenSet(vow.nav, (nav) => `nav: ${flow(nav)}`),
    ...whenSet(vow.shell, (shell) => `shell: ${flow(shell)}`),
  ];
}

/** The body sections — fields, proves, view, form, seed (only those present). */
function bodySections(vow: ReadonlyVow): string[] {
  const { fields, proof } = vow;
  return [
    ...when(
      fields.length > 0,
      () => `## fields\n\n${fields.map((field) => serializeField(field)).join("\n")}`,
    ),
    ...when(
      proof.length > 0,
      () => `## proves\n\n${proof.map((scenario) => `- ${scenario.claim}`).join("\n")}`,
    ),
    ...whenSet(vow.view, (view) =>
      yamlBlock(
        "view",
        view.map((node) => viewEntry(node)),
      ),
    ),
    ...whenSet(vow.form, (form) => formBlock(form)),
    ...whenSet(vow.seed, (seed) => yamlBlock("seed", seed)),
  ];
}

/** Serialize a Vow to its `<slug>.vow.md` text (children excluded — they are separate files). */
export function serialize(vow: ReadonlyVow): string {
  const fm = frontmatterLines(vow).join("\n");
  const body = [`# ${vow.intent}`, ...bodySections(vow)].join("\n\n");
  return `---\n${fm}\n---\n\n${body}\n`;
}

/** Write a vow (and recursively its children) to `<dir>/<slug>.vow.md`, mirroring `loadVows`'s mapping —
 *  children live in a sibling `<slug>/` folder. The save half of the author layer. */
export function writeVow(dir: string, vow: ReadonlyVow): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, vow.slug + SUFFIX), serialize(vow), "utf8");
  if (vow.children.length > 0) {
    const childDir = path.join(dir, vow.slug);
    for (const child of vow.children) {
      writeVow(childDir, child);
    }
  }
}
