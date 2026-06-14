/**
 * The loop's agent ROUTING — which TEAM specialist the autonomous loop dispatches per issue. There is ONE
 * source of agent definitions (`team.ts`, the 12 elite specialists with their full system prompts); this
 * module is the thin routing table that maps an issue's `area:` label to the matching team agent, so the
 * loop injects that specialist's COMPLETE brief into the develop plan — never a second, thinner roster to
 * drift from. The builder (`vow-developer`) is the default for general development; an area whose work is one
 * guardian's concern routes to that guardian.
 */

import { TEAM, teamByName, teamPrompt } from "./team.ts";
// oxlint-disable-next-line no-duplicate-imports -- the value import above; TeamAgent needs a top-level type import
import type { TeamAgent } from "./team.ts";

/** The team's general builder — the default specialist the loop dispatches when no area guardian owns the
 *  work (a feature/fix spanning the whole red line). One name, resolved against `team.ts` (the source). */
export const DEFAULT_AGENT = "vow-developer";

/** The routing table — an issue's `area:` label mapped to the TEAM specialist that owns it. An area absent
 *  here (or no `area:` label) falls to the builder (`DEFAULT_AGENT`). The values are team-agent names, so the
 *  table can never name an agent `team.ts` doesn't define (a startup check pins every value resolves). */
export const AREA_AGENT: Readonly<Record<string, string>> = {
  agent: "provider-neutrality-guard",
  component: "framework-neutrality-guard",
  core: "vow-developer",
  docs: "docs-keeper",
  emit: "framework-neutrality-guard",
  gate: "type-sentinel",
  github: "vow-developer",
  mcp: "security-auditor",
  observability: "vow-developer",
  primitives: "a11y-keeper",
  studio: "studio-dx",
};

/** The TEAM specialist the loop dispatches for `area` — the area's mapped guardian, or the builder
 *  (`vow-developer`) when no guardian owns it. Always a defined `TeamAgent` (both the mapped name and the
 *  default resolve against `team.ts`, the source of truth), so the caller never handles an absent agent. */
export function teamAgentFor(area: string): TeamAgent {
  const name = AREA_AGENT[area] ?? DEFAULT_AGENT;
  const agent = teamByName(name) ?? teamByName(DEFAULT_AGENT);
  if (agent) {
    return agent;
  }
  // Unreachable: `vow-developer` is always in TEAM (pinned by a test). The throw keeps the return type a
  // Defined `TeamAgent` without an `as` or a `!`, so a future rename of the builder fails loud, not silent.
  const [first] = TEAM;
  if (first) {
    return first;
  }
  throw new Error("the team is empty — no agent to route to");
}

/** The COMPLETE focus the loop injects into the develop plan for `area` — the matched TEAM specialist's full
 *  system prompt (preamble + vow's wall + its role + discipline), the same brief its committed
 *  `.claude/agents/<name>.md` carries. This is the upgrade from the old thin 2-line roster focus: the
 *  headless executor now develops with the right owner's complete expertise, not a generalist sketch. */
export function teamFocus(area: string): string {
  return teamPrompt(teamAgentFor(area));
}

/** The vow area an issue's labels name — the first `area: <x>` label's `<x>`, or "" when none. So an issue
 *  labelled `area: emit` routes (via `teamAgentFor`) to the emit area's specialist. */
export function areaOf(labels: readonly string[]): string {
  const prefix = "area: ";
  for (const label of labels) {
    if (label.startsWith(prefix)) {
      return label.slice(prefix.length);
    }
  }
  return "";
}
