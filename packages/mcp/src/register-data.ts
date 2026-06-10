import type { Names, Registrar, Row, Studio, TextResult } from "./types.ts";
import { json, text } from "./studio.ts";
import { defined } from "@vow/core";
import { z } from "zod";

/** Register the read/list data tools — list an entity's records, get one by id. */
function registerReads(server: Registrar, names: Names, studio: Studio): void {
  const listRecords = names.at("list_records");
  const getRecord = names.at("get_record");

  server.registerTool(
    listRecords.name,
    { description: listRecords.description, inputSchema: { entity: z.string() } },
    (input: { readonly entity: string }): TextResult => json(studio.listRecords(input.entity)),
  );

  server.registerTool(
    getRecord.name,
    { description: getRecord.description, inputSchema: { entity: z.string(), id: z.string() } },
    (input: { readonly entity: string; readonly id: string }): TextResult => {
      const row = studio.getRecord(input.entity, input.id);
      if (defined(row)) {
        return json(row);
      }
      return text(`no record "${input.id}"`);
    },
  );
}

/** Register the record-creating tools — add a record, remove one. */
function registerWrites(server: Registrar, names: Names, studio: Studio): void {
  const addRecord = names.at("add_record");
  const removeRecord = names.at("remove_record");

  server.registerTool(
    addRecord.name,
    {
      description: addRecord.description,
      inputSchema: { entity: z.string(), record: z.record(z.string(), z.unknown()) },
    },
    (input: { readonly entity: string; readonly record: Readonly<Row> }): TextResult =>
      json(studio.addRecord(input.entity, input.record)),
  );

  server.registerTool(
    removeRecord.name,
    { description: removeRecord.description, inputSchema: { entity: z.string(), id: z.string() } },
    (input: { readonly entity: string; readonly id: string }): TextResult => {
      if (studio.removeRecord(input.entity, input.id)) {
        return text(`removed record "${input.id}"`);
      }
      return text(`no record "${input.id}"`);
    },
  );
}

/** Register the record-patching tool — patch one field of a record. */
function registerPatch(server: Registrar, names: Names, studio: Studio): void {
  const setField = names.at("set_record_field");

  server.registerTool(
    setField.name,
    {
      description: setField.description,
      inputSchema: { entity: z.string(), field: z.string(), id: z.string(), value: z.unknown() },
    },
    (input: {
      readonly entity: string;
      readonly field: string;
      readonly id: string;
      readonly value: unknown;
    }): TextResult => {
      const row = studio.updateRecord({
        entity: input.entity,
        field: input.field,
        id: input.id,
        value: input.value,
      });
      if (defined(row)) {
        return json(row);
      }
      return text(`no record "${input.id}"`);
    },
  );
}

/**
 * Register the data tools — CRUD over an entity's records via the studio, against the shared local
 * SQLite file (the same one the dev studio / D1 serves). The studio resolves the table from a slug.
 */
export function registerData(server: Registrar, names: Names, studio: Studio): void {
  registerReads(server, names, studio);
  registerWrites(server, names, studio);
  registerPatch(server, names, studio);
}
