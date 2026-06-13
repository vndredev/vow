import { AUDIT_DIMENSIONS, runAuditPass, runDeepAuditPass } from "../src/agent-audit.ts";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import path from "node:path";
import { tmpdir } from "node:os";

/** The executable mode for the stub `claude` script (rwxr-xr-x). */
const EXECUTABLE = 0o755;

/**
 * `runAuditPass` shells `claude` per dimension. These tests stub `claude` via a temp `bin/` prepended to PATH,
 * so the pass is deterministic without a real model: the load-bearing invariant is that a BROKEN shell-out
 * (claude missing, or emitting non-array prose) reads as `broke: true`, NEVER as a findings-free `[]` — the
 * worst inversion of the loop's "findings-free -> power down" safety claim (#425).
 */

/** A throwaway repo with a fake `claude` on PATH that prints `output` (and `exit`s with that code). Returns
 *  the cwd + a `restore` to put PATH back + tear the dir down. An empty `output` with a non-zero `exit`
 *  models a failed shell-out. */
function stubClaude(output: string, exit = 0): { cwd: string; restore: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), "vow-audit-"));
  const bin = path.join(cwd, "bin");
  mkdirSync(bin, { recursive: true });
  const claude = path.join(bin, "claude");
  writeFileSync(claude, `#!/bin/sh\nprintf '%s' ${JSON.stringify(output)}\nexit ${exit}\n`);
  chmodSync(claude, EXECUTABLE);
  // oxlint-disable-next-line no-process-env -- the test prepends a stub bin so `claude` resolves to the fake
  const prior = process.env["PATH"] ?? "";
  // oxlint-disable-next-line no-process-env -- restored in `restore`, scoped to this test
  process.env["PATH"] = `${bin}:${prior}`;
  return {
    cwd,
    restore: () => {
      // oxlint-disable-next-line no-process-env -- restore the captured PATH
      process.env["PATH"] = prior;
      rmSync(cwd, { force: true, recursive: true });
    },
  };
}

/** A throwaway DEEP-AUDIT repo — a `packages/agent` slice + a `docs/` slice — with a fake `claude` on PATH
 *  that prints `output`. The slice directories exist so `discoverSlices` finds them; the stub handles all
 *  (slice × dimension) invocations uniformly. */
function stubDeep(output: string, exit = 0): { cwd: string; restore: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), "vow-deep-audit-"));
  mkdirSync(path.join(cwd, "packages", "agent"), { recursive: true });
  mkdirSync(path.join(cwd, "docs"), { recursive: true });
  const bin = path.join(cwd, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh\nprintf '%s' ${JSON.stringify(output)}\nexit ${exit}\n`,
  );
  chmodSync(path.join(bin, "claude"), EXECUTABLE);
  // oxlint-disable-next-line no-process-env -- prepend stub bin
  const prior = process.env["PATH"] ?? "";
  // oxlint-disable-next-line no-process-env -- restored in `restore`
  process.env["PATH"] = `${bin}:${prior}`;
  return {
    cwd,
    restore: () => {
      // oxlint-disable-next-line no-process-env -- restore
      process.env["PATH"] = prior;
      rmSync(cwd, { force: true, recursive: true });
    },
  };
}

test("runAuditPass: an empty-array audit across every dimension is a genuine findings-free pass", () => {
  const { cwd, restore } = stubClaude("[]");
  try {
    const result = runAuditPass("api", cwd);
    // Zero filed AND nothing broke -> the loop may power down (`done`).
    expect(result.filed).toBe(0);
    expect(result.broke).toBe(false);
  } finally {
    restore();
  }
});

test("runAuditPass: a non-array (prose) audit reads as BROKEN, never as findings-free", () => {
  // Claude erroring into prose (an instruction-less prompt, a refusal) must NOT fold to zero findings.
  const { cwd, restore } = stubClaude("I cannot help with that.");
  try {
    const result = runAuditPass("api", cwd);
    expect(result.broke).toBe(true);
    expect(result.filed).toBe(0);
  } finally {
    restore();
  }
});

test("runAuditPass: a failed shell-out (claude exits non-zero) reads as BROKEN", () => {
  const { cwd, restore } = stubClaude("", 1);
  try {
    expect(runAuditPass("api", cwd).broke).toBe(true);
  } finally {
    restore();
  }
});

test("AUDIT_DIMENSIONS includes docs/drift alongside the standard code-quality dimensions", () => {
  expect(AUDIT_DIMENSIONS).toContain("docs/drift");
  expect(AUDIT_DIMENSIONS).toContain("correctness");
  expect(AUDIT_DIMENSIONS).toContain("architecture");
});

test("runDeepAuditPass: a clean empty-array audit across every slice + dimension is findings-free", () => {
  const { cwd, restore } = stubDeep("[]");
  try {
    const result = runDeepAuditPass("api", cwd);
    expect(result.filed).toBe(0);
    expect(result.broke).toBe(false);
  } finally {
    restore();
  }
});

test("runDeepAuditPass: a non-array (prose) response for any slice reads as BROKEN, never findings-free", () => {
  const { cwd, restore } = stubDeep("I cannot help with that.");
  try {
    const result = runDeepAuditPass("api", cwd);
    expect(result.broke).toBe(true);
    expect(result.filed).toBe(0);
  } finally {
    restore();
  }
});

test("runDeepAuditPass: a failed shell-out (claude exits non-zero) reads as BROKEN", () => {
  const { cwd, restore } = stubDeep("", 1);
  try {
    expect(runDeepAuditPass("api", cwd).broke).toBe(true);
  } finally {
    restore();
  }
});
