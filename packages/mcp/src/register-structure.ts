import { Field, FieldType, ViewNode } from "@vow/core";
import type {
  FieldPatch,
  Maybe,
  Names,
  ReadonlyField,
  Registrar,
  Studio,
  TextResult,
} from "./types.ts";
import { VIEW_NODE_TYPES, assertKnownViewType, requireSafeNames } from "@vow/emit-view";
import { text } from "./studio.ts";
import { z } from "zod";

/** Reject a view whose node carries an unknown `type` BEFORE it reaches disk — the shared
 *  `assertKnownViewType` (same check, same message, the allowed set listed) the emitter runs at build, so
 *  `add_view`/`set_view` fail synchronously instead of at `vp dev`. */
function requireKnownTypes(view: readonly ViewInput[]): void {
  for (const node of view) {
    assertKnownViewType(node.type);
  }
}

/** The nav-entry shape (frontmatter: label · icon · order · group) — parsed, so no cast is needed. */
const Nav = z.object({
  group: z.string().optional(),
  icon: z.string().optional(),
  label: z.string().optional(),
  order: z.number().optional(),
});

/** The app-shell layout (on the root view): where the nav lives · the content width · the visual style —
 *  the same vocabulary as `vow.ts`'s `shell`. */
const Shell = z.object({
  nav: z.enum(["sidebar-left", "sidebar-right", "header", "footer"]).optional(),
  variant: z.enum(["bordered", "seamless", "cards"]).optional(),
  width: z.enum(["center", "full"]).optional(),
});

type NavInput = z.infer<typeof Nav>;
type ShellInput = z.infer<typeof Shell>;
type ViewInput = z.infer<typeof ViewNode>;

/** Register `add_entity` — a new data model + its DB table. */
function registerAddEntity(server: Registrar, names: Names, studio: Studio): void {
  const addEntity = names.at("add_entity");

  server.registerTool(
    addEntity.name,
    {
      description: addEntity.description,
      inputSchema: { fields: z.array(Field).optional(), intent: z.string(), slug: z.string() },
    },
    (input: {
      readonly fields: Maybe<readonly ReadonlyField[]>;
      readonly intent: string;
      readonly slug: string;
    }): TextResult => {
      const slug = studio.createEntity({
        fields: input.fields ?? [],
        intent: input.intent,
        slug: input.slug,
      });
      return text(`added entity "${slug}"`);
    },
  );
}

/** Register `add_view` — a new page built from a `## view`. */
function registerAddView(server: Registrar, names: Names, studio: Studio): void {
  const addView = names.at("add_view");

  const description = `${addView.description} A node's \`type\` is one of: ${VIEW_NODE_TYPES.join(", ")}.`;

  server.registerTool(
    addView.name,
    {
      description,
      inputSchema: {
        intent: z.string(),
        nav: Nav.optional(),
        root: z.boolean().optional(),
        shell: Shell.optional(),
        slug: z.string(),
        title: z.string().optional(),
        view: z.array(ViewNode),
      },
    },
    (input: {
      readonly intent: string;
      readonly nav: Maybe<NavInput>;
      readonly root: Maybe<boolean>;
      readonly shell: Maybe<ShellInput>;
      readonly slug: string;
      readonly title: Maybe<string>;
      readonly view: readonly ViewInput[];
    }): TextResult => {
      requireKnownTypes(input.view);
      requireSafeNames(input.view);
      const slug = studio.createView({
        intent: input.intent,
        nav: input.nav,
        root: input.root,
        shell: input.shell,
        slug: input.slug,
        title: input.title,
        view: input.view,
      });
      return text(`added view "${slug}"`);
    },
  );
}

/** Register `add_form` — a bound, validated `## form` over an entity (its own page). */
function registerAddForm(server: Registrar, names: Names, studio: Studio): void {
  const addForm = names.at("add_form");

  server.registerTool(
    addForm.name,
    {
      description: addForm.description,
      inputSchema: {
        edit: z.boolean().optional(),
        intent: z.string(),
        nav: Nav.optional(),
        of: z.string(),
        slug: z.string(),
        submit: z.string(),
      },
    },
    (input: {
      readonly edit: Maybe<boolean>;
      readonly intent: string;
      readonly nav: Maybe<NavInput>;
      readonly of: string;
      readonly slug: string;
      readonly submit: string;
    }): TextResult => {
      const slug = studio.createForm({
        edit: input.edit,
        intent: input.intent,
        nav: input.nav,
        of: input.of,
        slug: input.slug,
        submit: input.submit,
      });
      return text(`added form "${slug}"`);
    },
  );
}

/** Register `set_form` — edit a form's `of`/`submit`/`edit` (the singleton-editor flag) in place. */
function registerSetForm(server: Registrar, names: Names, studio: Studio): void {
  const setForm = names.at("set_form");

  server.registerTool(
    setForm.name,
    {
      description: setForm.description,
      inputSchema: {
        edit: z.boolean().optional(),
        of: z.string().optional(),
        slug: z.string(),
        submit: z.string().optional(),
      },
    },
    (input: {
      readonly edit: Maybe<boolean>;
      readonly of: Maybe<string>;
      readonly slug: string;
      readonly submit: Maybe<string>;
    }): TextResult => {
      studio.editForm(input.slug, { edit: input.edit, of: input.of, submit: input.submit });
      return text(`set form of "${input.slug}"`);
    },
  );
}

/** Register `set_view` — replace a vow's `## view` (the page tree) in place, the inverse of add_view. */
function registerSetView(server: Registrar, names: Names, studio: Studio): void {
  const setView = names.at("set_view");

  const description = `${setView.description} A node's \`type\` is one of: ${VIEW_NODE_TYPES.join(", ")}.`;

  server.registerTool(
    setView.name,
    {
      description,
      inputSchema: { slug: z.string(), view: z.array(ViewNode) },
    },
    (input: { readonly slug: string; readonly view: readonly ViewInput[] }): TextResult => {
      requireKnownTypes(input.view);
      requireSafeNames(input.view);
      studio.editView(input.slug, input.view);
      return text(`set view of "${input.slug}"`);
    },
  );
}

/** Register `set_seed` — replace an entity's versioned `## seed` records (the data that travels with the spec). */
function registerSetSeed(server: Registrar, names: Names, studio: Studio): void {
  const setSeed = names.at("set_seed");

  server.registerTool(
    setSeed.name,
    {
      description: setSeed.description,
      inputSchema: { entity: z.string(), seed: z.array(z.record(z.string(), z.unknown())) },
    },
    (input: {
      readonly entity: string;
      readonly seed: readonly Readonly<Record<string, unknown>>[];
    }): TextResult => {
      studio.editSeed(input.entity, input.seed);
      return text(`set seed of "${input.entity}"`);
    },
  );
}

/** Register the vow-editing tools — set intent / nav, remove a vow. */
function registerEditors(server: Registrar, names: Names, studio: Studio): void {
  const setIntent = names.at("set_intent");
  const setNav = names.at("set_nav");
  const removeVow = names.at("remove_vow");

  server.registerTool(
    setIntent.name,
    { description: setIntent.description, inputSchema: { intent: z.string(), slug: z.string() } },
    (input: { readonly intent: string; readonly slug: string }): TextResult => {
      studio.setIntent(input.slug, input.intent);
      return text(`set intent of "${input.slug}"`);
    },
  );

  server.registerTool(
    setNav.name,
    { description: setNav.description, inputSchema: { nav: Nav, slug: z.string() } },
    (input: { readonly nav: NavInput; readonly slug: string }): TextResult => {
      studio.setNav(input.slug, input.nav);
      return text(`set nav of "${input.slug}"`);
    },
  );

  server.registerTool(
    removeVow.name,
    { description: removeVow.description, inputSchema: { slug: z.string() } },
    (input: { readonly slug: string }): TextResult => {
      studio.dropVow(input.slug);
      return text(`removed vow "${input.slug}"`);
    },
  );
}

/** Register the field tools — add / remove a field on an entity (then re-derive the DB schema). */
function registerFields(server: Registrar, names: Names, studio: Studio): void {
  const addField = names.at("add_field");
  const removeField = names.at("remove_field");

  server.registerTool(
    addField.name,
    { description: addField.description, inputSchema: { entity: z.string(), field: Field } },
    (input: { readonly entity: string; readonly field: ReadonlyField }): TextResult => {
      studio.createField(input.entity, input.field);
      return text(`added field "${input.field.name}" to "${input.entity}"`);
    },
  );

  server.registerTool(
    removeField.name,
    {
      description: removeField.description,
      inputSchema: { entity: z.string(), field: z.string() },
    },
    (input: { readonly entity: string; readonly field: string }): TextResult => {
      studio.dropField(input.entity, input.field);
      return text(`removed field "${input.field}" from "${input.entity}"`);
    },
  );
}

/** Register `set_field` — edit a field in place (rename, retype, toggle required, edit options/ref). A
 *  rename carries the stored column data (the studio issues `ALTER TABLE … RENAME COLUMN`). */
function registerSetField(server: Registrar, names: Names, studio: Studio): void {
  const setField = names.at("set_field");

  server.registerTool(
    setField.name,
    {
      description: setField.description,
      inputSchema: {
        entity: z.string(),
        field: z.string(),
        name: z.string().optional(),
        options: z.array(z.string()).optional(),
        ref: z.string().optional(),
        required: z.boolean().optional(),
        type: FieldType.optional(),
      },
    },
    (input: { readonly entity: string; readonly field: string } & FieldPatch): TextResult => {
      studio.editField(input.entity, input.field, {
        name: input.name,
        options: input.options,
        ref: input.ref,
        required: input.required,
        type: input.type,
      });
      return text(`set field "${input.field}" on "${input.entity}"`);
    },
  );
}

/**
 * Register the structure tools — they write the vows (`app/*.vow.md`) via the studio's seam to
 * `@vow/core`'s mutations. An entity/field change re-derives the DB schema so a following data tool
 * sees the new shape; a running `vp dev` regenerates `.generated` from the same edit.
 */
export function registerStructure(server: Registrar, names: Names, studio: Studio): void {
  registerAddEntity(server, names, studio);
  registerAddView(server, names, studio);
  registerAddForm(server, names, studio);
  registerSetForm(server, names, studio);
  registerSetView(server, names, studio);
  registerSetSeed(server, names, studio);
  registerEditors(server, names, studio);
  registerFields(server, names, studio);
  registerSetField(server, names, studio);
}
