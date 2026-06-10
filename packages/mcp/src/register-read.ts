import type { Maybe, Names, ReadonlyVow, Registrar, Studio, TextResult } from "./types.ts";
import { json, text } from "./studio.ts";
import { defined } from "@vow/core";
import { gitRemoteUrl } from "@vow/observability";
import path from "node:path";
import process from "node:process";
import { resolveDbPath } from "@vow/db";
import { z } from "zod";

/** A maybe-absent string as a plain string — absence becomes the empty string. */
function orEmpty(value: Maybe<string>): string {
  if (defined(value)) {
    return value;
  }
  return "";
}

/** A vow's read view — the fields the `list_vows` summary exposes. */
function summarise(vow: ReadonlyVow): {
  fulfills: ReadonlyVow["fulfills"];
  intent: string;
  slug: string;
} {
  return { fulfills: vow.fulfills, intent: vow.intent, slug: vow.slug };
}

/** Register the read tools — list/get a vow + the studio's paths and structure. */
export function registerRead(server: Registrar, names: Names, studio: Studio): void {
  const { appDir } = studio;
  const listVows = names.at("list_vows");
  const getVow = names.at("get_vow");
  const studioInfo = names.at("studio_info");

  server.registerTool(listVows.name, { description: listVows.description, inputSchema: {} }, () =>
    json(studio.listVows().map((vow: ReadonlyVow) => summarise(vow))),
  );

  server.registerTool(
    getVow.name,
    { description: getVow.description, inputSchema: { slug: z.string() } },
    (input: { readonly slug: string }): TextResult => {
      const found = studio.getVow(input.slug);
      if (defined(found)) {
        return json(found);
      }
      return text(`no vow "${input.slug}"`);
    },
  );

  server.registerTool(
    studioInfo.name,
    { description: studioInfo.description, inputSchema: {} },
    () =>
      json({
        appDir,
        dbPath: resolveDbPath(path.dirname(appDir)),
        entities: studio.entitySlugs(),
        project: process.env["VOW_PROJECT_ID"] ?? "",
        repo: orEmpty(gitRemoteUrl(appDir)),
        views: studio.viewSlugs(),
      }),
  );
}
