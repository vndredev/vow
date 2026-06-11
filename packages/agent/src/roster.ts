/**
 * The agent roster — vow's own specialized agent per area, provider-neutral. One agent does one area well
 * (focused context, fewer drift surfaces); the orchestrator composes them across the audit -> plan ->
 * develop loop. The roster is DATA (an area + its focus), so a host (Claude Code's workflows, or another
 * runtime) fans them out — the substance is vow's, the runtime the host's.
 */

/** A specialized agent — the `area` it owns + a `focus` (a system-prompt fragment that narrows it to that
 *  concern, prepended to the gated plan so the executor stays in its lane). */
export interface AgentSpec {
  readonly area: string;
  readonly focus: string;
}

/** The roster — vow's areas mapped to their specialized agents. */
export type Roster = readonly AgentSpec[];

/** The default roster — one agent per vow area, each focused by that area's invariant. */
export const DEFAULT_ROSTER: Roster = [
  {
    area: "emit",
    focus:
      "You own code generation (the emitters). Generate THROUGH the canonical component model + the " +
      "neutral adapters — never hand-write rendered output. It stays byte-stable, pinned by tests.",
  },
  {
    area: "gate",
    focus:
      "You own the gates + guards. A gate is a mechanical rule that blocks drift, not a plea. When a " +
      "check can be enforced, make it a gate AND a test that proves it fires.",
  },
  {
    area: "studio",
    focus:
      "You own the studio app. Compose everything from vow primitives + tokens — no hardcoded values, " +
      "no parallel UI. The studio reads the plan (the issues); it never hand-seeds it.",
  },
  {
    area: "docs",
    focus:
      "You own the docs (a generated vow app). Keep them 1:1 with the real state — honest, no " +
      "overselling, maintained with every feature.",
  },
  {
    area: "core",
    focus:
      "You own the Vow primitive + the data layer. Status is NEVER stored (it is derived). One recursive " +
      "node; the contract is the parser + loader. Keep the core minimal + invariant.",
  },
];

/** The general agent — when no area specialist owns the work. */
const GENERAL: AgentSpec = {
  area: "general",
  focus:
    "Stay strictly inside the task's scope; touch only what it names; every gate must pass before the PR.",
};

/** The specialized agent for `area` in `roster`, or the general agent when none owns it. */
export function agentFor(roster: Roster, area: string): AgentSpec {
  const spec = roster.find((each) => each.area === area);
  if (spec) {
    return spec;
  }
  return GENERAL;
}
