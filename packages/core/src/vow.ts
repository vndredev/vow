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

export const Status = z.enum(["planned", "active", "done", "blocked"]);
export type Status = z.infer<typeof Status>;

/** Immutable reference key — `<prefix>_<suffix>`. References always point at the id, never the slug. */
const Id = z.string().regex(/^[a-z]+_[a-z0-9]+$/, "id must be <prefix>_<suffix>");
/** Renamable label, kebab-case. */
const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");
const Line = z.string().trim().min(3).max(200);

/**
 * How a Vow is redeemed — both type-verified, never via comment anchors:
 *  - `emit`: a generated artifact (Vue SFC, types) → verified by `vp build` / `vp check` (tsgo)
 *  - `bind`: hand-written code, structurally bound through the TS API → verified by tsgo
 */
export const Fulfillment = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("emit"), as: Line }),
  z.object({ kind: z.literal("bind"), module: Line, export: Line }),
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
  .regex(/^[a-z][a-zA-Z0-9]*$/, "field name must be a camelCase identifier");
export const Field = z.object({
  name: FieldName,
  type: FieldType,
  required: z.boolean().default(false),
  /** Allowed values for a `select` field — absent for other types. */
  options: z.array(z.string()).optional(),
  /** The target entity slug for a `reference` field (it points at that entity's id) — absent otherwise. */
  ref: z.string().optional(),
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

/** An `emit form` spec (a `## form`): a form bound to an entity (`of: <slug>`), with a submit label. */
export interface FormSpec {
  readonly of?: string;
  readonly submit: string;
}

export const FormSpec = z.object({
  of: z.string().optional(),
  submit: z.string().default("Submit"),
});

export interface Vow {
  readonly id: string;
  readonly slug: string;
  readonly intent: string;
  readonly children: readonly Vow[];
  /** Absent = pure composition (a vow that only groups children). */
  readonly fulfills?: Fulfillment;
  /** Data shape for `emit entity` vows — empty for everything else. */
  readonly fields: readonly Field[];
  readonly proof: readonly Scenario[];
  /** Optional view (`## view`, YAML) — a list of components (semantic blocks + primitive escape). */
  readonly view?: readonly ViewNode[];
  /** Optional form (`## form`, YAML) — for an `emit form` vow, bound to an entity. */
  readonly form?: FormSpec;
  /** `root: true` marks the app's entry page — vow generates the boot that mounts it. */
  readonly root?: boolean;
  /** App-shell title (the brand), read from the root vow's frontmatter — replaces `vow({ title })`. */
  readonly title?: string;
  /** Nav entry in the app shell (frontmatter) — label · icon · order · group (a surface). */
  readonly nav?: {
    readonly label?: string;
    readonly icon?: string;
    readonly order?: number;
    readonly group?: string;
  };
  /** The app-shell kind, on the root vow — `sidebar` today (`top` is the reserved next variant). */
  readonly shell?: "sidebar";
}

export const Vow: z.ZodType<Vow> = z.lazy(() =>
  z.object({
    id: Id,
    slug: Slug,
    intent: Line,
    children: z.array(Vow).default([]),
    fulfills: Fulfillment.optional(),
    fields: z.array(Field).default([]),
    proof: z.array(Scenario).default([]),
    view: z.array(ViewNode).optional(),
    form: FormSpec.optional(),
    root: z.boolean().optional(),
    title: z.string().optional(),
    nav: z
      .object({
        label: z.string().optional(),
        icon: z.string().optional(),
        order: z.number().optional(),
        group: z.string().optional(),
      })
      .optional(),
    shell: z.literal("sidebar").optional(),
  }),
);
