import { defaultPrompt, promptRelPath } from "@vow/agent";
import { existsSync, readFileSync } from "node:fs";
// oxlint-disable-next-line no-duplicate-imports -- the value import above; PromptRole is a top-level type
import type { PromptRole } from "@vow/agent";
import path from "node:path";

/**
 * The prompt READER — the ONE file glue that lets a user-edited prompt drive every surface. `@vow/agent` owns
 * the canonical defaults + the paths (pure); this resolves the scaffolded file under the repo root and reads
 * it, falling back to the built-in default when it is absent. So editing `.claude/prompts/audit.md` changes
 * the agent's behaviour without touching vow's source, while a fresh repo (no scaffold) still runs the
 * default. Exported via the `@vow/cli/agent-prompts` subpath so EVERY caller — the native agent (plan/audit),
 * and the host-orchestration scripts — imports the same reader with the same fallback, never a private copy.
 * The seam can't lie: the same `defaultPrompt(role)` is both the fallback HERE and exactly what `init` writes.
 */

/** Resolve `role`'s scaffolded prompt under `cwd` — the provider-relative path joined to the repo root. */
export function promptPath(cwd: string, role: PromptRole): string {
  return path.join(cwd, promptRelPath(role));
}

/** The operative prompt for `role` — the scaffolded `.claude/prompts/<role>.md` when present, else the
 *  built-in default (`defaultPrompt`). The returned text still carries its `{…}` placeholders; the caller
 *  fills the live facts (the dimension / the issue) via the agent's render functions. */
export function readPrompt(cwd: string, role: PromptRole): string {
  const file = promptPath(cwd, role);
  if (existsSync(file)) {
    return readFileSync(file, "utf8");
  }
  return defaultPrompt(role);
}
