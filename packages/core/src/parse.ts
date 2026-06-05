import { parse as parseYaml } from "yaml";
import { Vow, type Fulfillment, type Vow as VowNode } from "./vow.ts";

/**
 * Parse a `vow.md` — plain Markdown, no invented DSL:
 *   - YAML frontmatter for the non-prosaic truth (`id`, `fulfills`, `kind`)
 *   - `# …`        → the intent (the promise)
 *   - `## proves`  → the proof scenarios (one per list item)
 *   - the slug comes from the folder name, not the file
 *
 * `fulfills` uses a compact value convention (still standard YAML strings, trivial to read/write):
 *   `emit vue`              → { kind: "emit", as: "vue" }
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

/** Collect the `- …` items under a `## proves` heading, until the next heading or EOF. */
function parseProves(body: string): { claim: string }[] {
  const claims: { claim: string }[] = [];
  let inProves = false;
  for (const line of body.split("\n")) {
    if (/^##\s+proves\s*$/i.test(line)) {
      inProves = true;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      inProves = false;
      continue;
    }
    const item = /^-\s+(.+)$/.exec(line.trim());
    if (inProves && item?.[1]) claims.push({ claim: item[1].trim() });
  }
  return claims;
}

/** Parse one `vow.md` into a validated Vow. `slug` is supplied by the loader (the folder name). */
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
    fulfills: parseFulfills(frontmatter["fulfills"]),
    proof: parseProves(body),
  });
}
