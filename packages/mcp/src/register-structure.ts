import { Field, ViewNode } from "@vow/core";
import type { Maybe, Names, ReadonlyField, Registrar, Studio, TextResult } from "./types.ts";
import { text } from "./studio.ts";
import { z } from "zod";

/** The nav-entry shape (frontmatter: label · icon · order · group) — parsed, so no cast is needed. */
const Nav = z.object({
  group: z.string().optional(),
  icon: z.string().optional(),
  label: z.string().optional(),
  order: z.number().optional(),
});

type NavInput = z.infer<typeof Nav>;
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

  server.registerTool(
    addView.name,
    {
      description: addView.description,
      inputSchema: {
        intent: z.string(),
        nav: Nav.optional(),
        slug: z.string(),
        view: z.array(ViewNode),
      },
    },
    (input: {
      readonly intent: string;
      readonly nav: Maybe<NavInput>;
      readonly slug: string;
      readonly view: readonly ViewInput[];
    }): TextResult => {
      const slug = studio.createView({
        intent: input.intent,
        nav: input.nav,
        slug: input.slug,
        view: input.view,
      });
      return text(`added view "${slug}"`);
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

/**
 * Register the structure tools — they write the vows (`app/*.vow.md`) via the studio's seam to
 * `@vow/core`'s mutations. An entity/field change re-derives the DB schema so a following data tool
 * sees the new shape; a running `vp dev` regenerates `.generated` from the same edit.
 */
export function registerStructure(server: Registrar, names: Names, studio: Studio): void {
  registerAddEntity(server, names, studio);
  registerAddView(server, names, studio);
  registerEditors(server, names, studio);
  registerFields(server, names, studio);
}
