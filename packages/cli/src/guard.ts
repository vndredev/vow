import { mainDrift, protectMain } from "@vow/observability";

/** Print the drift (or "holds") and return the exit code. */
function reportDrift(drift: readonly string[]): number {
  if (drift.length === 0) {
    process.stdout.write("main protection holds — PR-only · gate · no bypass · 0 reviews\n");
    return 0;
  }
  for (const line of drift) {
    process.stderr.write(`  drift: ${line}\n`);
  }
  return 1;
}

/**
 * `vow guard [--check]` — enforce vow's non-negotiable protection on main, then report any drift. With
 * `--check` it only reports (for CI). The config is a core invariant — there is no setting to loosen it.
 */
export function guard(rest: readonly string[]): number {
  const cwd = process.cwd();
  if (!rest.includes("--check")) {
    protectMain(cwd);
  }
  return reportDrift(mainDrift(cwd));
}
