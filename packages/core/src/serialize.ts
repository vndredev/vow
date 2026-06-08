import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { SUFFIX } from "./load.ts";
import type { Field, Vow } from "./vow.ts";

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
function serializeFulfills(f: Vow["fulfills"]): string | undefined {
  if (!f) return undefined;
  return f.kind === "emit" ? `emit ${f.as}` : `bind ${f.module}#${f.export}`;
}

/** One `## fields` line — the inverse of `parseFieldLine`. */
function serializeField(f: Field): string {
  let head: string;
  if (f.type === "select") head = `select(${(f.options ?? []).join("|")})`;
  else if (f.type === "reference") head = `reference(${f.ref ?? ""})`;
  else head = f.type;
  return `- ${f.name}: ${head}${f.required ? ", required" : ""}`;
}

/** A `## <heading>` with a fenced ```yaml block. */
function yamlBlock(heading: string, value: unknown): string {
  return `## ${heading}\n\n\`\`\`yaml\n${stringify(value).trimEnd()}\n\`\`\``;
}

/** Serialize a Vow to its `<slug>.vow.md` text (children excluded — they are separate files). */
export function serialize(vow: Vow): string {
  const fm: string[] = [`id: ${vow.id}`];
  const fulfills = serializeFulfills(vow.fulfills);
  if (fulfills !== undefined) fm.push(`fulfills: ${fulfills}`);
  if (vow.root === true) fm.push(`root: true`);
  if (vow.title !== undefined) fm.push(stringify({ title: vow.title }).trim()); // quotes if needed
  if (vow.nav !== undefined) fm.push(`nav: ${flow(vow.nav)}`);
  if (vow.shell !== undefined) fm.push(`shell: ${flow(vow.shell)}`);

  const body: string[] = [`# ${vow.intent}`];
  if (vow.fields.length > 0) body.push(`## fields\n\n${vow.fields.map(serializeField).join("\n")}`);
  if (vow.proof.length > 0) {
    body.push(`## proves\n\n${vow.proof.map((p) => `- ${p.claim}`).join("\n")}`);
  }
  if (vow.view !== undefined) {
    body.push(
      yamlBlock(
        "view",
        vow.view.map((n) => ({ [n.type]: n.value })),
      ),
    );
  }
  if (vow.form !== undefined) {
    const form =
      vow.form.of !== undefined
        ? { of: vow.form.of, submit: vow.form.submit }
        : { submit: vow.form.submit };
    body.push(yamlBlock("form", form));
  }
  if (vow.seed !== undefined) body.push(yamlBlock("seed", vow.seed));

  return `---\n${fm.join("\n")}\n---\n\n${body.join("\n\n")}\n`;
}

/** Write a vow (and recursively its children) to `<dir>/<slug>.vow.md`, mirroring `loadVows`'s mapping —
 *  children live in a sibling `<slug>/` folder. The save half of the author layer. */
export function writeVow(dir: string, vow: Vow): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, vow.slug + SUFFIX), serialize(vow), "utf8");
  if (vow.children.length > 0) {
    const childDir = join(dir, vow.slug);
    for (const child of vow.children) writeVow(childDir, child);
  }
}
