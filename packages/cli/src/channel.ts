import process from "node:process";
import { runChannel } from "@vow/mcp/channel";

/**
 * `vow channel` — run the vow Claude Code Channels adapter (`@vow/mcp`'s provider-neutral feed bridged into
 * a connected session). Claude Code spawns this over stdio via `.mcp.json` (+ the dev-channels flag); it
 * connects, tails the event feed under the cwd, and pushes each new event in, staying up until the session
 * closes the pipe. The path-independent launcher `vow agent init` installs into `.mcp.json`.
 */
export async function runChannelServer(): Promise<number> {
  await runChannel(process.cwd());
  return 0;
}
