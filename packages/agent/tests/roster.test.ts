import { AREA_AGENT, DEFAULT_AGENT, areaOf, teamAgentFor, teamFocus } from "../src/roster.ts";
import { TEAM, teamPrompt } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("the routing table names only real team agents — one source of agent definitions, no parallel roster", () => {
  const names = new Set(TEAM.map((agent) => agent.name));
  // The default (the builder) and every routed name resolve against team.ts — no roster to drift from.
  expect(names).toContain(DEFAULT_AGENT);
  for (const name of Object.values(AREA_AGENT)) {
    expect(names).toContain(name);
  }
});

test("teamAgentFor routes an area's label to its team specialist", () => {
  // A guardian-owned area routes to that guardian; the develop loop dispatches it.
  expect(teamAgentFor("gate").name).toBe("type-sentinel");
  expect(teamAgentFor("primitives").name).toBe("a11y-keeper");
  expect(teamAgentFor("studio").name).toBe("studio-dx");
});

test("teamAgentFor falls back to the builder for an unrouted area or no area label", () => {
  expect(teamAgentFor("nope").name).toBe(DEFAULT_AGENT);
  expect(teamAgentFor("").name).toBe(DEFAULT_AGENT);
});

test("teamFocus injects the TEAM agent's COMPLETE prompt, not a thin 2-line roster focus", () => {
  const focus = teamFocus("gate");
  // The full team-agent brief: the shared preamble, vow's wall, AND the specialist's own role.
  expect(focus).toBe(teamPrompt(teamAgentFor("gate")));
  expect(focus).toContain("Read AGENTS.md first");
  // The strict wall is baked in — the headless agent honours it without rediscovering it by failing.
  expect(focus).toContain("oxlint");
  expect(focus).toContain("STRICT TYPE + LINT WALL");
  // Not a sketch: the full role is far longer than the old ~2-line roster focus.
  const oldRosterFocusBudget = 240;
  expect(focus.length).toBeGreaterThan(oldRosterFocusBudget);
});

test("areaOf reads the `area:` label, else empty", () => {
  expect(areaOf(["enhancement", "area: emit"])).toBe("emit");
  expect(areaOf(["enhancement"])).toBe("");
});
