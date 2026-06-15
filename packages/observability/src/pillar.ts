import type { Maybe } from "./types.ts";
import { NONE } from "./none.ts";

/**
 * The throughline — vow's north-star decomposed into the four enduring PILLARS it builds toward. A pillar
 * is orthogonal to a phase: a milestone is WHEN (the dated roadmap), a pillar is WHAT, toward the
 * north-star. Every issue carries one, so the plan steers by capability, not only by date. `resolvePillar`
 * is a heuristic router (a sensible default by theme, like `currentPhase` defaults a milestone); a caller
 * may set an explicit `pillar:` label to override, and the reconcile gate flags any that route nowhere.
 * The pillar is purely text-derived (no I/O), so `ensurePillar` runs inside `createIssue` — every issue
 * vow opens carries a pillar by construction.
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

/** Every pillar label — the throughline's GitHub label set (for label creation + validation). */
export const PILLAR_LABELS: readonly string[] = NORTH_STAR.map((pillar) => pillar.label);

/** The pillar a piece of work advances — the first north-star pillar whose signal appears in `text` (an
    issue's title + body, lower-cased). `NONE` when nothing matches, so the caller flags it rather than
    mis-route. The `NORTH_STAR` order is the precedence. Pure. */
export function resolvePillar(text: string): Maybe<string> {
  const haystack = text.toLowerCase();
  for (const pillar of NORTH_STAR) {
    if (pillar.signals.some((signal) => haystack.includes(signal))) {
      return pillar.label;
    }
  }
  return NONE;
}

/** The labels a new issue carries, with a pillar guaranteed: the given labels unchanged when one already
    carries a `pillar:` label (an explicit override), else the routed pillar appended — or unchanged when
    nothing routes (the reconcile gate then flags the issue). Pure. */
export function ensurePillar(labels: readonly string[], text: string): readonly string[] {
  if (labels.some((label) => label.startsWith(PILLAR_PREFIX))) {
    return labels;
  }
  const pillar = resolvePillar(text);
  if (typeof pillar === "string") {
    return [...labels, pillar];
  }
  return labels;
}
