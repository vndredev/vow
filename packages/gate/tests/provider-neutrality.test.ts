import { expect, test } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { providerViolations } from "../src/providers.ts";

/** One agent source, as `providerViolations` takes them. */
type AgentSource = Parameters<typeof providerViolations>[0][number];

/* The only agent module allowed to name a provider CLI — the provider seam, where an adapter lives. */
const ALLOW = ["provider.ts"];

/** The packages the gate scans: @vow/agent owns the seam; @vow/cli and @vow/mcp actually SPAWN the bin, so a
 *  future hardcode there must not slip past. Sibling packages, named relative to this gate package. */
const SCANNED_PACKAGES = ["agent", "cli", "mcp"];

/** Read every `.ts` source under each scanned package's `src` (siblings to this gate package). */
function agentSources(): AgentSource[] {
  return SCANNED_PACKAGES.flatMap((pkg) => {
    const dir = path.resolve(import.meta.dirname, "..", "..", pkg, "src");
    return readdirSync(dir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => ({ file: name, source: readFileSync(path.join(dir, name), "utf8") }));
  });
}

test("no agent-stack module hardcodes a provider CLI — only the provider seam names one", () => {
  expect(providerViolations(agentSources(), ALLOW)).toEqual([]);
});

test("a legitimate .claude host path and the Claude Code host name are not flagged", () => {
  const benign: AgentSource[] = [
    { file: "agent.ts", source: 'scaffold(path.join(cwd, ".claude", "skills"))' },
    { file: "agent-templates.ts", source: "return `In Claude Code, drive this`;" },
  ];
  expect(providerViolations(benign, [])).toEqual([]);
});

test("the gate catches a hardcoded provider (so a bypass can't pass silently)", () => {
  const planted: AgentSource[] = [{ file: "drift.ts", source: 'run({ bin: "claude" })' }];
  expect(providerViolations(planted, [])).not.toEqual([]);
});
