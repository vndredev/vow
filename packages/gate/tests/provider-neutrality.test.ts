import { expect, test } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { providerViolations } from "../src/providers.ts";

/** One agent source, as `providerViolations` takes them. */
type AgentSource = Parameters<typeof providerViolations>[0][number];

/* The only agent module allowed to name a provider CLI — the provider seam, where an adapter lives. */
const ALLOW = ["provider.ts"];

/** Read every @vow/agent `.ts` source (sibling to this gate package). */
function agentSources(): AgentSource[] {
  const dir = path.resolve(import.meta.dirname, "..", "..", "agent", "src");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({ file: name, source: readFileSync(path.join(dir, name), "utf8") }));
}

test("no agent module hardcodes a provider CLI — only the provider seam names one", () => {
  expect(providerViolations(agentSources(), ALLOW)).toEqual([]);
});

test("the gate catches a hardcoded provider (so a bypass can't pass silently)", () => {
  const planted: AgentSource[] = [{ file: "drift.ts", source: 'run({ bin: "claude" })' }];
  expect(providerViolations(planted, [])).not.toEqual([]);
});
