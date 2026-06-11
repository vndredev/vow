/**
 * The agent layer's shared types — kept value-free so every module imports them as a pure `import type`
 * (the repo forbids mixing a type + a value from one module; a dedicated `types.ts` is the convention).
 */

/** A task for an autonomous coding agent: develop `plan` in `cwd`, on its own `branch`, with `model` (when
 *  set; else the provider's default). */
export interface AgentTask {
  readonly branch: string;
  readonly cwd: string;
  readonly model?: string;
  readonly plan: string;
  readonly title: string;
}

/** A model's role in the loop — the capable model plans + audits; a cheaper one executes the gated plan. */
export type Role = "audit" | "execute" | "plan";

/** Maps each role to the model that fills it — the best model of the day plugs in per role, no code change. */
export interface ModelPolicy {
  readonly audit: string;
  readonly execute: string;
  readonly plan: string;
}

/** A command to spawn — what to exec, built but never run in the pure core (so the mapping stays testable). */
export interface Command {
  readonly args: readonly string[];
  readonly bin: string;
}

/** A coding-CLI provider — the one seam every agent backend implements. */
export interface Provider {
  readonly command: (task: AgentTask) => Command;
  readonly name: string;
}

/** The issue a plan is built from — its number, title, and body (the element + the why). */
export interface IssueSpec {
  readonly body: string;
  readonly number: number;
  readonly title: string;
}

/** The repo facts a plan inlines: the gates to run + the commit the plan was written against. */
export interface PlanContext {
  readonly commit: string;
  readonly verify: readonly string[];
}

/** The result of an autonomous run. */
export interface DispatchResult {
  readonly ok: boolean;
  readonly output: string;
}

/** A command's exit code + captured output. */
export interface RunResult {
  readonly code: number;
  readonly output: string;
}

/** The side effects dispatch needs, injected so the orchestration is testable. */
export interface AgentOps {
  readonly run: (command: Command, cwd: string) => Promise<RunResult>;
  readonly worktreeAdd: (path: string, branch: string) => Promise<void>;
  readonly worktreeRemove: (path: string) => Promise<void>;
}

/** One gate's outcome — the command and whether it passed. */
export interface GateResult {
  readonly command: string;
  readonly ok: boolean;
}

/** The verdict of re-running a plan's gates: the per-gate results + their conjunction. */
export interface VerifyResult {
  readonly ok: boolean;
  readonly results: readonly GateResult[];
}

/** A PR's CI conclusion — what the agent-merge decision keys on. */
export type CiState = "fail" | "pass" | "pending";

/** Everything one full loop over an issue needs — bundled so `runTask` takes a single argument. */
export interface TaskRequest {
  readonly context: PlanContext;
  readonly cwd: string;
  readonly issue: IssueSpec;
  readonly ops: AgentOps;
  readonly provider: Provider;
}

/** The outcome of one full loop over an issue: the run + the verification verdict. */
export interface TaskOutcome {
  readonly run: DispatchResult;
  readonly verdict: VerifyResult;
}
