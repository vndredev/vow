import { expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { installHooks } from "../src/agent.ts";
import path from "node:path";
import { tmpdir } from "node:os";

/** A throwaway repo root for the settings-merge tests — install hooks here, then tear it down. */
function tempRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "vow-hooks-"));
}

/** The parsed `.claude/settings.json` written under `cwd`. */
function settings(cwd: string): unknown {
  return JSON.parse(readFileSync(path.join(cwd, ".claude", "settings.json"), "utf8"));
}

/** Hand-write a `.claude/settings.json` under `cwd` that already wires the user's own hooks. */
function writeUserSettings(cwd: string, value: unknown): void {
  const dir = path.join(cwd, ".claude");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "settings.json"), JSON.stringify(value));
}

test("installHooks writes BOTH the PreToolUse guard and the SessionStart bootstrap entries", () => {
  const cwd = tempRepo();
  try {
    installHooks(cwd);
    const json = JSON.stringify(settings(cwd));
    // The PreToolUse guard (#584) — every Bash call hits `vow hook`.
    expect(json).toContain('"$CLAUDE_PROJECT_DIR/node_modules/.bin/vow hook"');
    expect(json).toContain('"Bash"');
    // The SessionStart bootstrap — `vow hook session-start` on startup/clear/compact.
    expect(json).toContain('"$CLAUDE_PROJECT_DIR/node_modules/.bin/vow hook session-start"');
    expect(json).toContain("startup|clear|compact");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("installHooks wires the local-bin command (#651) — resolves without a global vow on PATH", () => {
  const cwd = tempRepo();
  try {
    installHooks(cwd);
    const json = JSON.stringify(settings(cwd));
    // The command is the project-root-anchored local bin, NOT the bare `vow` (which needs a global install).
    expect(json).toContain("$CLAUDE_PROJECT_DIR/node_modules/.bin/vow");
    // No bare `"vow hook"` entry survives — that only resolves when vow is on PATH (installed globally).
    expect(json).not.toContain('"vow hook"');
    // FAST, not npx — the PreToolUse hook fires on every Bash call, so no per-call resolution latency.
    expect(json).not.toContain("npx");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("installHooks adds the SessionStart entry without dropping a user's PreToolUse hook", () => {
  const cwd = tempRepo();
  try {
    // A settings file the user already hand-wired with their OWN PreToolUse hook.
    writeUserSettings(cwd, {
      hooks: { PreToolUse: [{ hooks: [{ command: "my-own-guard", type: "command" }] }] },
    });
    installHooks(cwd);
    const json = JSON.stringify(settings(cwd));
    // The user's hook survives, AND both vow entries are merged in beside it.
    expect(json).toContain("my-own-guard");
    expect(json).toContain('"$CLAUDE_PROJECT_DIR/node_modules/.bin/vow hook"');
    expect(json).toContain('"$CLAUDE_PROJECT_DIR/node_modules/.bin/vow hook session-start"');
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("installHooks is idempotent — a re-run that finds both vow entries touches nothing", () => {
  const cwd = tempRepo();
  try {
    const first = installHooks(cwd);
    expect(first).toContain("wrote");
    const before = settings(cwd);
    const second = installHooks(cwd);
    expect(second).toContain("kept");
    // No duplicate entries — the second run left the file as-is.
    expect(settings(cwd)).toEqual(before);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("hasVowHooks is idempotent against the local-bin command strings (#651) — no duplicate on re-run", () => {
  const cwd = tempRepo();
  try {
    // A settings file already hand-wired with the NEW local-bin command strings.
    writeUserSettings(cwd, {
      hooks: {
        PreToolUse: [
          {
            hooks: [{ command: "$CLAUDE_PROJECT_DIR/node_modules/.bin/vow hook", type: "command" }],
          },
        ],
        SessionStart: [
          {
            hooks: [
              {
                command: "$CLAUDE_PROJECT_DIR/node_modules/.bin/vow hook session-start",
                type: "command",
              },
            ],
          },
        ],
      },
    });
    // Re-running init recognises the new strings as already-present and touches nothing.
    expect(installHooks(cwd)).toContain("kept");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});
