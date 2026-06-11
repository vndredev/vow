import { execFileSync } from "node:child_process";

/** A coarse CI verdict for a PR — the agent-merge gate reads this, then decides merge / draft / wait. */
export type PrCi = "fail" | "pass" | "pending";

/** Whether a value is a non-null object — the entry to safely walk a gh JSON payload. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** One check's verdict from its gh `status` + `conclusion`: not-completed -> pending; a clean conclusion
    (success / neutral / skipped) -> pass; anything else -> fail. */
function checkState(check: unknown): PrCi {
  if (!isObject(check) || check["status"] !== "COMPLETED") {
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
