/**
 * The agent layer — provider-neutral orchestration of an autonomous coding CLI. vow describes a task; a
 * `Provider` (Claude Code today; Codex / Gemini as further adapters over this one interface) turns it into
 * the headless command that develops it, and `dispatch` runs it in an isolated git worktree. Commands are
 * *built*, never run in the pure core — a runner execs them — so the mapping is unit-testable and the loop
 * never names a provider. This is the seam the provider-neutrality gate (#107) guards.
 */

export * from "./auto.ts";
export * from "./bootstrap.ts";
export * from "./dispatch.ts";
export * from "./dry-run.ts";
export * from "./gate-correction.ts";
export * from "./hook.ts";
export * from "./loop.ts";
export * from "./merge.ts";
export * from "./model.ts";
export * from "./orchestrate.ts";
export * from "./plan.ts";
export * from "./prompts.ts";
export * from "./provider.ts";
export * from "./real-ops.ts";
export * from "./report.ts";
export * from "./review.ts";
export * from "./roster.ts";
export * from "./skills.ts";
export * from "./team.ts";
export type * from "./types.ts";
export * from "./verify.ts";
