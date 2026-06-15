import type { Registrar, Studio } from "./types.ts";
import { names } from "./register.ts";
import { registerCode } from "./register-code.ts";
import { registerData } from "./register-data.ts";
import { registerDocs } from "./register-docs.ts";
import { registerGithub } from "./register-github.ts";
import { registerRead } from "./register-read.ts";
import { registerStructure } from "./register-structure.ts";

/**
 * Compose every register module over one server — the single place the tool set is assembled. The
 * entry (`server.ts`) passes the live `McpServer` + `Studio`; the catalogue test passes a fresh server
 * + a shape-only `Studio` (handlers never run at registration). Returns the registered names in order,
 * for the server <-> catalogue drift check.
 */
export function composeTools(server: Registrar, studio: Studio): readonly string[] {
  const recorder = names();
  registerRead(server, recorder, studio);
  registerStructure(server, recorder, studio);
  registerData(server, recorder, studio);
  registerDocs(server, recorder, studio);
  registerGithub(server, recorder, studio);
  registerCode(server, recorder);
  return recorder.all;
}
