#!/usr/bin/env -S node --experimental-strip-types

/**
 * The CI entry behind the PR-body gate: read the PR body from `PR_BODY` (the workflow passes
 * `github.event.pull_request.body`), run it through `prBodyProblems`, and exit 1 with an actionable,
 * template-pointing message when a section is missing or empty. A filled body exits 0. The structure
 * rule itself lives in `pr-body.ts` (pure, unit-tested); this only wires it to the process.
 */

import { prBodyProblems } from "./pr-body.ts";

const TEMPLATE = ".github/PULL_REQUEST_TEMPLATE.md";

/** Validate `process.env.PR_BODY`; print the problems and return the exit code (0 ok, 1 failed). */
function main(): number {
  // oxlint-disable-next-line no-process-env -- the workflow passes the PR body in as PR_BODY
  const body = process.env["PR_BODY"] ?? "";
  const problems = prBodyProblems(body);
  if (problems.length === 0) {
    process.stdout.write("PR body matches the template.\n");
    return 0;
  }
  for (const problem of problems) {
    process.stdout.write(`::error::${problem}\n`);
  }
  process.stdout.write(`Fill the PR template (${TEMPLATE}) — Summary, What, Proof, Next.\n`);
  return 1;
}

process.exit(main());
