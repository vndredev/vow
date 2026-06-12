import { execFileSync } from "node:child_process";

/** A coarse CI verdict for a PR — the agent-merge gate reads this, then decides merge / draft / wait. */
export type PrCi = "fail" | "pass" | "pending";

/** Whether a value is a non-null object — the entry to safely walk a gh JSON payload. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A legacy `StatusContext` node carries no `status` — only a `state`: SUCCESS / NEUTRAL -> pass,
    PENDING / EXPECTED -> pending, anything else (FAILURE / ERROR) -> fail. Keeps a red commit status from
    falling through to `pending` (which would make the merge loop wait on red forever). */
function stateState(check: Readonly<Record<string, unknown>>): PrCi {
  const clean = check["state"] === "SUCCESS" || check["state"] === "NEUTRAL";
  if (clean) {
    return "pass";
  }
  if (check["state"] === "PENDING" || check["state"] === "EXPECTED") {
    return "pending";
  }
  return "fail";
}

/** One check's verdict. A modern `CheckRun` reads `status` + `conclusion`: not-completed -> pending; a clean
    conclusion (success / neutral / skipped) -> pass; anything else -> fail. A legacy `StatusContext` (no
    `status`) reads `state` instead, so a red commit status is never mistaken for pending. */
function checkState(check: unknown): PrCi {
  if (!isObject(check)) {
    return "pending";
  }
  if (!("status" in check)) {
    return stateState(check);
  }
  if (check["status"] !== "COMPLETED") {
    return "pending";
  }
  const clean = check["conclusion"] === "SUCCESS" || check["conclusion"] === "NEUTRAL";
  if (clean || check["conclusion"] === "SKIPPED") {
    return "pass";
  }
  return "fail";
}

/** The `statusCheckRollup` array from a `gh pr view` payload, or `[]` when absent / malformed. */
function rollupOf(json: string): readonly unknown[] {
  try {
    const data: unknown = JSON.parse(json);
    if (isObject(data) && Array.isArray(data["statusCheckRollup"])) {
      return data["statusCheckRollup"];
    }
  } catch {
    return [];
  }
  return [];
}

/** Fold a `gh pr view --json statusCheckRollup` payload into one verdict: any failed check -> fail, else
    any pending -> pending, else pass. An empty / absent rollup is `pending` (checks not registered). Pure. */
export function ciStateFrom(json: string): PrCi {
  const rollup = rollupOf(json);
  if (rollup.length === 0) {
    return "pending";
  }
  const states = new Set(rollup.map((check) => checkState(check)));
  if (states.has("fail")) {
    return "fail";
  }
  if (states.has("pending")) {
    return "pending";
  }
  return "pass";
}

/** The CI verdict for PR `pr` via `gh pr view --json statusCheckRollup`; `pending` when gh can't be read. */
export function prCiState(cwd: string, pr: number): PrCi {
  try {
    const out = execFileSync("gh", ["pr", "view", String(pr), "--json", "statusCheckRollup"], {
      cwd,
      encoding: "utf8",
    });
    return ciStateFrom(out);
  } catch {
    return "pending";
  }
}

/** The `headRefOid` from a `gh pr view` payload, or `""` when absent / malformed. */
function headOf(json: string): string {
  try {
    const data: unknown = JSON.parse(json);
    if (isObject(data) && typeof data["headRefOid"] === "string") {
      return data["headRefOid"];
    }
  } catch {
    return "";
  }
  return "";
}

/** A SHA-pinned verdict: the rollup must belong to `expectedHead`. After an `update-branch` rebase, gh can
    still report the PREVIOUS (green) run until the fresh run registers; treating any non-matching head as
    `pending` makes the merge loop WAIT for the rebased CI rather than merge a stale-green branch. Pure. */
export function ciStateForHead(json: string, expectedHead: string): PrCi {
  if (expectedHead === "" || headOf(json) !== expectedHead) {
    return "pending";
  }
  return ciStateFrom(json);
}

/** The CI verdict for PR `pr` pinned to `expectedHead` via `gh pr view --json headRefOid,statusCheckRollup`;
    `pending` when gh can't be read or the reported head doesn't match (the rebased run hasn't registered). */
export function prCiStateForHead(cwd: string, pr: number, expectedHead: string): PrCi {
  try {
    const out = execFileSync(
      "gh",
      ["pr", "view", String(pr), "--json", "headRefOid,statusCheckRollup"],
      { cwd, encoding: "utf8" },
    );
    return ciStateForHead(out, expectedHead);
  } catch {
    return "pending";
  }
}

/** PR `pr`'s current head commit SHA via `gh pr view --json headRefOid`, or `""` when gh can't be read — the
    pin the settle loop captures right after `update-branch` so it only merges on a run for that exact head. */
export function prHeadOid(cwd: string, pr: number): string {
  try {
    const out = execFileSync("gh", ["pr", "view", String(pr), "--json", "headRefOid"], {
      cwd,
      encoding: "utf8",
    });
    return headOf(out);
  } catch {
    return "";
  }
}
