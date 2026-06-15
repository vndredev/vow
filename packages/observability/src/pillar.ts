/**
 * The throughline — vow's north-star decomposed into the four enduring PILLARS it builds toward. A pillar
 * is the WHAT axis, toward the north-star. The plan steers by capability: the local `@vow/plan` carries a
 * pillar per item (the `pillar:` label is the migration source the sync reads), and the studio's Map view
 * groups by it via `NORTH_STAR`. The pillar is purely text-derived (no I/O).
 */

/** The `pillar:` label prefix — the throughline's namespace on an issue's labels. */
export const PILLAR_PREFIX = "pillar:";

/** A north-star pillar — its label, title, the horizon that marks it "done", and the keyword signals the
    router matches in an issue's text. */
export interface Pillar {
  readonly horizon: string;
  readonly label: string;
  readonly signals: readonly string[];
  readonly title: string;
}

/**
 * THE NORTH STAR — the four pillars in narrative order (the product, how it builds, how it plans, what
 * keeps it honest). The array order is also the router's precedence: the first pillar whose signal
 * appears wins. Signals are lower-case substrings matched against an issue's title + body.
 */
export const NORTH_STAR: readonly Pillar[] = [
  {
    horizon:
      "An LLM describes rich UI; vow emits a real, themed, accessible app — spec to DSL depth.",
    label: "pillar:describe-to-app",
    signals: [
      "emit",
      "spec",
      "primitive",
      "render",
      "component",
      "design",
      "token",
      "theme",
      "headless",
      "a11y",
      "dsl",
      "ladder",
    ],
    title: "Describe → App",
  },
  {
    horizon:
      "Vow develops itself and your app through a provider-neutral, gated agent loop + the team.",
    label: "pillar:self-building",
    signals: [
      "agent",
      "loop",
      "team",
      "develop",
      "worktree",
      "provider",
      "fleet",
      "orchestrat",
      "merge",
      "guardian",
      "skill",
    ],
    title: "Self-building",
  },
  {
    horizon:
      "Vow plans, audits, and steers its own work — the plan IS its issues, roadmap, and cockpit.",
    label: "pillar:self-planning",
    signals: [
      "issue",
      "plan",
      "roadmap",
      "milestone",
      "cockpit",
      "audit",
      "reconcile",
      "board",
      "trace",
      "observab",
      "dashboard",
      "timeline",
    ],
    title: "Self-planning",
  },
  {
    horizon:
      "The wall makes LLM work converge: gates, hooks, the externalized picture, durable memory.",
    label: "pillar:mechanical-integrity",
    signals: [
      "gate",
      "hook",
      "lint",
      "wall",
      "drift",
      "memory",
      "security",
      "coverage",
      "neutrality",
      "layer",
      "validate",
    ],
    title: "Mechanical integrity",
  },
];
