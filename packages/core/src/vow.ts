import { z } from "zod";

/**
 * The one primitive: a **Vow** — a promise, recursively decomposed, fulfilled and proven.
 *
 * It collapses the old split — plan, code, test, and the two kinds of spec
 * (governance vs. app) — into a single recursive node:
 *
 *   - `intent`   — what & why (the human/LLM-readable promise)
 *   - `children` — the decomposition (sub-vows; empty = a leaf)
 *   - `fulfills` — HOW it's redeemed: `emit` (generated) or `bind` (hand-written, type-bound)
 *   - `proof`    — testable claims (scenarios)
 *   - status     — NEVER stored; derived from children + fulfilment + proof (see rollup.ts)
 *
 * vow itself is a Vow tree; a generated app is a Vow tree — same grammar, different fulfilment.
 * What can be derived is never stored → drift-free by construction.
 */

/** The shortest a `Line` (intent · proof claim · fulfilment field) may be. */
const LINE_MIN = 3;
/** The longest a `Line` may be — a promise is a sentence, not a paragraph. */
const LINE_MAX = 200;

export const Status = z.enum(["planned", "active", "done", "blocked"]);
export type Status = z.infer<typeof Status>;

/** Immutable reference key — `<prefix>_<suffix>`. References always point at the id, never the slug. */
const Id = z.string().regex(/^[a-z]+_[a-z0-9]+$/u, "id must be <prefix>_<suffix>");
/** Renamable label, kebab-case. */
const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "must be kebab-case");
const Line = z.string().trim().min(LINE_MIN).max(LINE_MAX);

/**
 * How a Vow is redeemed — both type-verified, never via comment anchors:
 *  - `emit`: a generated artifact (Vue SFC, types) → verified by `vp build` / `vp check` (tsgo)
 *  - `bind`: hand-written code, structurally bound through the TS API → verified by tsgo
 */
export const Fulfillment = z.discriminatedUnion("kind", [
  z.object({ as: Line, kind: z.literal("emit") }),
  z.object({ export: Line, kind: z.literal("bind"), module: Line }),
]);
export type Fulfillment = z.infer<typeof Fulfillment>;

/** A testable claim. A Vow's "tested-ness" is DERIVED (scenario green), never hand-set. */
export const Scenario = z.object({ claim: Line });
export type Scenario = z.infer<typeof Scenario>;

/** The primitive types a field can take — the seam the entity emitter turns into TS + validation. */
export const FieldType = z.enum([
  "text",
  "longtext",
  "number",
  "boolean",
  "select",
  "date",
  "reference",
]);
export type FieldType = z.infer<typeof FieldType>;

/** A field on an `entity` vow: a camelCase name, a type, and whether it's required. */
const FieldName = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*$/u, "field name must be a camelCase identifier");
/**
 * A `select` option's value. Unlike slug/FieldName it is free text (it is shown to the user verbatim),
 * but it must never carry the `</` tag-open sequence: an option lands in a generated `<script setup>`
 * body, where a `</script>` would close the block early and run as markup (a stored-XSS sink). The
 * emitter neutralizes it too (`scriptJson`); forbidding it here is the boundary's defense-in-depth.
 */
const SelectOption = z.string().regex(/^[^<]*$/u, "a select option must not contain '<'");
/** The bare field shape, before the per-type rules below tighten it. */
const FieldShape = z.object({
  name: FieldName,
  /** Allowed values for a `select` field — absent for other types. */
  options: z.array(SelectOption).optional(),
  /** The target entity slug for a `reference` field (it points at that entity's id) — absent otherwise. */
  ref: z.string().optional(),
  required: z.boolean().default(false),
  type: FieldType,
});

/** The two type-specific keys the rules below inspect — read-only to their leaves (no mutable array). */
interface FieldDraft {
  readonly options?: readonly string[] | undefined;
  readonly ref?: string | undefined;
  readonly type: FieldType;
}

/** A `reference` carries a non-empty `ref`; any other type is unconstrained on `ref`. */
function refOk(field: FieldDraft): boolean {
  return field.type !== "reference" || (field.ref ?? "") !== "";
}

/** A `select` carries a non-empty `options`; any other type is unconstrained on `options`. */
function optionsOk(field: FieldDraft): boolean {
  return field.type !== "select" || (field.options ?? []).length > 0;
}

/*
 * A `reference` is meaningless without a target, and a `select` without its values; reject those shapes
 * here with an actionable message, so the boundary (add_field / add_entity) fails precisely rather than
 * later as "references the empty string, which is not a known entity".
 */
export const Field = FieldShape.refine(refOk, {
  error: "a reference field requires a non-empty ref naming the target entity",
  path: ["ref"],
}).refine(optionsOk, {
  error: "a select field requires a non-empty options list",
  path: ["options"],
});
export type Field = z.infer<typeof Field>;

/**
 * A node in a view's `## view` (YAML): one component, keyed by name, with its raw value. The format
 * layer stays UI-agnostic — core only knows "a named component with some value" (`{ hero: {...} }`,
 * `{ list: "task" }`, `{ flex: { children: [...] } }`); the emitter decides what each component means.
 */
export interface ViewNode {
  readonly type: string;
  readonly value: unknown;
}

export const ViewNode = z.object({ type: z.string(), value: z.unknown() });

/**
 * An `emit form` spec (a `## form`): a form bound to an entity (`of: <slug>`), with a submit label.
 * `edit: true` makes it a singleton editor — it pre-loads the entity's latest row and updates it in
 * place (instead of appending a new record). Optional members carry `| undefined` so the zod-inferred
 * output (always `key?: T | undefined`) is assignable under `exactOptionalPropertyTypes`.
 */
export interface FormSpec {
  readonly edit?: boolean | undefined;
  readonly of?: string | undefined;
  readonly submit: string;
}

export const FormSpec = z.object({
  edit: z.boolean().optional(),
  of: z.string().optional(),
  submit: z.string().default("Submit"),
});

/**
 * The Vow node. Optional members carry `| undefined` so the zod-inferred parse output (always
 * `key?: T | undefined`) is assignable under `exactOptionalPropertyTypes` — the schema below IS this
 * interface, so `Vow.parse(...)` returns a `Vow` with no cast.
 */
export interface Vow {
  readonly id: string;
  readonly slug: string;
  readonly intent: string;
  readonly children: readonly Vow[];
  /** Absent = pure composition (a vow that only groups children). */
  readonly fulfills?: Fulfillment | undefined;
  /** Data shape for `emit entity` vows — empty for everything else. */
  readonly fields: readonly Field[];
  readonly proof: readonly Scenario[];
  /** Optional view (`## view`, YAML) — a list of components (semantic blocks + primitive escape). */
  readonly view?: readonly ViewNode[] | undefined;
  /** Optional form (`## form`, YAML) — for an `emit form` vow, bound to an entity. */
  readonly form?: FormSpec | undefined;
  /** Sample records (`## seed`, YAML) — bootstrapped into the DB once, if the entity's table is empty. */
  readonly seed?: readonly Record<string, unknown>[] | undefined;
  /** `root: true` marks the app's entry page — vow generates the boot that mounts it. */
  readonly root?: boolean | undefined;
  /** App-shell title (the brand), read from the root vow's frontmatter — replaces `vow({ title })`. */
  readonly title?: string | undefined;
  /** Nav entry in the app shell (frontmatter) — label · icon · order · group (a surface). */
  readonly nav?:
    | {
        readonly label?: string | undefined;
        readonly icon?: string | undefined;
        readonly order?: number | undefined;
        readonly group?: string | undefined;
      }
    | undefined;
  /** The app-shell layout, on the root vow — where the nav lives, the content width, the visual style. */
  readonly shell?:
    | {
        readonly nav?: "sidebar-left" | "sidebar-right" | "header" | "footer" | undefined;
        readonly width?: "center" | "full" | undefined;
        readonly variant?: "bordered" | "seamless" | "cards" | undefined;
      }
    | undefined;
}

/**
 * The recursive schema. Children are typed through a getter (the zod-4 recursion seam): the property is
 * an array of `Vow` itself, resolved lazily so the cycle type-checks. The schema output is the `Vow`
 * interface above — the gate parses real `.vow.md` against it (see parse.ts).
 */
export const Vow = z.object({
  get children(): z.ZodDefault<z.ZodArray<typeof Vow>> {
    return z.array(Vow).default([]);
  },
  fields: z.array(Field).default([]),
  form: FormSpec.optional(),
  fulfills: Fulfillment.optional(),
  id: Id,
  intent: Line,
  nav: z
    .object({
      group: z.string().optional(),
      icon: z.string().optional(),
      label: z.string().optional(),
      order: z.number().optional(),
    })
    .optional(),
  proof: z.array(Scenario).default([]),
  root: z.boolean().optional(),
  seed: z.array(z.record(z.string(), z.unknown())).optional(),
  shell: z
    .object({
      nav: z.enum(["sidebar-left", "sidebar-right", "header", "footer"]).optional(),
      variant: z.enum(["bordered", "seamless", "cards"]).optional(),
      width: z.enum(["center", "full"]).optional(),
    })
    .optional(),
  slug: Slug,
  title: z.string().optional(),
  view: z.array(ViewNode).optional(),
});
