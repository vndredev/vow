import { execFileSync } from "node:child_process";

/**
 * The repo's branch protection — owned by vow: declared here, applied + drift-checked by vow itself,
 * never a manual `gh` click. A direct push to a protected branch is the drift this prevents; the config
 * living in the core (not a one-off setting) is how it can't silently loosen.
 */

/** The protection vow requires on a branch. */
export interface ProtectionSpec {
  readonly checks: readonly string[];
  readonly enforceAdmins: boolean;
  readonly reviews: number;
}

/**
 * The NON-NEGOTIABLE protection vow requires on `main` — a core invariant, never a studio setting, never
 * user-configurable. Maximum security + quality is what vow IS; loosening it is not an option offered
 * anywhere. PR-only, the `gate` check must pass, no admin bypass; solo-dev so 0 human reviews — the agent
 * merges when the gate is green, never the user.
 */
export const MAIN_PROTECTION: ProtectionSpec = {
  checks: ["gate"],
  enforceAdmins: true,
  reviews: 0,
};

/** The live protection on a branch, reduced to the subset vow cares about. */
export interface ProtectionState {
  readonly checks: readonly string[];
  readonly enforceAdmins: boolean;
  readonly requirePr: boolean;
  readonly reviews: number;
}

/** Whether `enforce_admins.enabled` is true in a gh protection object. */
function enforceAdminsOf(raw: unknown): boolean {
  if (typeof raw === "object" && raw !== null && "enforce_admins" in raw) {
    const flag = raw.enforce_admins;
    return typeof flag === "object" && flag !== null && "enabled" in flag && flag.enabled === true;
  }
  return false;
}

/** Whether a PR is required (the reviews object is present). */
function requirePrOf(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "required_pull_request_reviews" in raw &&
    raw.required_pull_request_reviews !== null
  );
}

/** The required approving review count, or 0. */
function reviewsOf(raw: unknown): number {
  if (typeof raw === "object" && raw !== null && "required_pull_request_reviews" in raw) {
    const reviews = raw.required_pull_request_reviews;
    if (
      typeof reviews === "object" &&
      reviews !== null &&
      "required_approving_review_count" in reviews &&
      typeof reviews.required_approving_review_count === "number"
    ) {
      return reviews.required_approving_review_count;
    }
  }
  return 0;
}

/** The required status-check contexts, or []. */
function contextsOf(raw: unknown): string[] {
  if (typeof raw === "object" && raw !== null && "required_status_checks" in raw) {
    const checks = raw.required_status_checks;
    if (typeof checks === "object" && checks !== null && "contexts" in checks) {
      const { contexts } = checks;
      if (Array.isArray(contexts)) {
        return contexts.filter((context) => typeof context === "string");
      }
    }
  }
  return [];
}

/** Parse a `gh api .../branches/<b>/protection` object into the subset vow checks. Pure. */
export function parseProtection(json: string): ProtectionState {
  const raw: unknown = JSON.parse(json);
  return {
    checks: contextsOf(raw),
    enforceAdmins: enforceAdminsOf(raw),
    requirePr: requirePrOf(raw),
    reviews: reviewsOf(raw),
  };
}

/** The required checks in `spec` the live state is missing. */
function missingChecks(state: ProtectionState, spec: ProtectionSpec): string[] {
  const out: string[] = [];
  for (const check of spec.checks) {
    if (!state.checks.includes(check)) {
      out.push(`the "${check}" check is not required`);
    }
  }
  return out;
}

/** Where the live protection drifts from the spec — empty means it matches. Pure. */
export function protectionDrift(state: ProtectionState, spec: ProtectionSpec): string[] {
  const out: string[] = missingChecks(state, spec);
  if (!state.requirePr) {
    out.push("a PR is not required");
  }
  if (state.enforceAdmins !== spec.enforceAdmins) {
    out.push(`enforce_admins=${state.enforceAdmins}, want ${spec.enforceAdmins}`);
  }
  if (state.reviews !== spec.reviews) {
    out.push(`required reviews=${state.reviews}, want ${spec.reviews}`);
  }
  return out;
}

/** A CI-readable verdict on the live protection — `ok` is the gate (false fails the run), `report` is the
 *  one-line summary the workflow prints. */
export interface DriftReport {
  readonly ok: boolean;
  readonly report: string;
}

/** Turn a drift list into a CI verdict: empty -> a green "holds" line, else a red multi-line list every
 *  drift gets its own line in. Pure — this is what the CI workflow + `vow guard --check` both render. */
export function driftReport(drift: readonly string[]): DriftReport {
  if (drift.length === 0) {
    return { ok: true, report: "main protection holds - PR-only - gate - no bypass - 0 reviews" };
  }
  const lines = drift.map((line) => `  drift: ${line}`);
  return { ok: false, report: ["main protection has drifted:", ...lines].join("\n") };
}

/** The `gh api ... -X PUT` body that enforces `spec`. Built as a string so `restrictions: null` (which the
 *  API requires to clear restrictions) needs no null literal. Pure. */
export function protectionPayload(spec: ProtectionSpec): string {
  const contexts = spec.checks.map((check) => `"${check}"`).join(",");
  return [
    `{"required_status_checks":{"strict":false,"contexts":[${contexts}]},`,
    `"enforce_admins":${spec.enforceAdmins},`,
    `"required_pull_request_reviews":{"required_approving_review_count":${spec.reviews}},`,
    `"restrictions":null}`,
  ].join("");
}

/** Apply `spec` to `branch` via `gh api`. Internal — the public entry is `protectMain` (no override). */
function applyProtection(cwd: string, branch: string, spec: ProtectionSpec): void {
  execFileSync(
    "gh",
    ["api", `repos/{owner}/{repo}/branches/${branch}/protection`, "-X", "PUT", "--input", "-"],
    { cwd, encoding: "utf8", input: protectionPayload(spec) },
  );
}

/** Read the live protection on `branch`. Internal — the public entry is `mainDrift`. */
function readProtection(cwd: string, branch: string): ProtectionState {
  const out = execFileSync("gh", ["api", `repos/{owner}/{repo}/branches/${branch}/protection`], {
    cwd,
    encoding: "utf8",
  });
  return parseProtection(out);
}

/** Enforce vow's non-negotiable protection on `main` — the only public entry; no spec to pass, no setting
 *  to loosen it. */
export function protectMain(cwd: string): void {
  applyProtection(cwd, "main", MAIN_PROTECTION);
}

/** Where `main`'s live protection drifts from vow's invariant — empty means it holds. */
export function mainDrift(cwd: string): string[] {
  return protectionDrift(readProtection(cwd, "main"), MAIN_PROTECTION);
}

/**
 * Read `main`'s live protection and report whether it matches vow's invariant — the CI entry. `gh` reads
 * branch protection only with an admin-scope token, so the `protection-drift` workflow must run this with
 * an admin PAT (`VOW_ADMIN_TOKEN`) in `GH_TOKEN`; the default `GITHUB_TOKEN` can't and the workflow gates
 * the step on the secret being present. `ok=false` is the failing verdict the CI step exits on.
 */
export function checkMainDrift(cwd: string): DriftReport {
  return driftReport(mainDrift(cwd));
}
