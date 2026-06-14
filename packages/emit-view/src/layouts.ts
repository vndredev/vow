/**
 * The live-feed layout registries, re-exported as one surface — the `events`/`issues`/`loop`/`mcp` view
 * nodes each map an `as:` value to the fixed component the plugin materialises. Gathering the sibling
 * registries here lets `map-node.ts` (and `refs.ts`) bind every live layout through a single import, so the
 * dispatcher's dependency count stays within the module-boundary cap as more live layouts are added.
 */
export { EVENT_LAYOUTS, eventLayout } from "./event-layout.ts";
export { ISSUE_LAYOUTS, issueLayout } from "./issue-layout.ts";
export { LOOP_LAYOUTS, loopLayout } from "./loop-layout.ts";
export { MCP_LAYOUTS, mcpLayout } from "./mcp-layout.ts";
