import { decomment } from "./framework.ts";

/**
 * The provider-neutrality gate — the agent layer (@vow/agent) may name a provider CLI (claude/codex/
 * gemini) in ONE place only: the provider seam (`provider.ts`), the single spot an adapter lives behind.
 * A CLI name in code anywhere else IS the single-provider hardcode this gate forbids — so swapping Claude
 * for Codex or Gemini is a new Provider, never a hunt through the loop. Pure: the caller reads the files,
 * this only matches — so the rule is unit-testable without the filesystem.
 */

/** The provider CLIs that must appear only behind the provider seam. */
const PROVIDERS = new Set(["claude", "codex", "gemini"]);

/** A run of ASCII letters — a candidate word for the provider scan. */
const PROVIDER_WORD = /[a-z]+/gu;

/** One agent source file to scan — its name (the allowlist key) and its full contents. */
export interface AgentSource {
  readonly file: string;
  readonly source: string;
}

/** A hardcoded provider found outside the seam — the file, and the CLI name it wrote. */
export interface ProviderViolation {
  readonly file: string;
  readonly provider: string;
}

/** The provider names a code string contains (comments stripped, lowercased whole-word match). */
function providersIn(code: string): string[] {
  const found = new Set<string>();
  for (const word of code.toLowerCase().match(PROVIDER_WORD) ?? []) {
    if (PROVIDERS.has(word)) {
      found.add(word);
    }
  }
  return [...found];
}

/**
 * Every provider-CLI name an agent source wrote outside the `allow` seam (today: `provider.ts`). An empty
 * result means every other agent module is provider-neutral. Pure — unit-testable without the filesystem.
 */
export function providerViolations(
  sources: readonly AgentSource[],
  allow: readonly string[],
): ProviderViolation[] {
  const violations: ProviderViolation[] = [];
  for (const source of sources) {
    if (!allow.includes(source.file)) {
      for (const provider of providersIn(decomment(source.source))) {
        violations.push({ file: source.file, provider });
      }
    }
  }
  return violations;
}
