import { expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readConfigProjectUrl, resolveProjectId } from "../src/project.ts";
import { NONE } from "../src/none.ts";
import path from "node:path";
import { tmpdir } from "node:os";

const PROJECT_URL = "https://github.com/users/vndredev/projects/3";

/** A fresh repo root with `apps/studio/app/config.vow.md` seeded `project:` exactly as the studio writes it. */
function seedConfig(project: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "vow-proj-cfg-"));
  const appDir = path.join(dir, "apps", "studio", "app");
  mkdirSync(appDir, { recursive: true });
  writeFileSync(
    path.join(appDir, "config.vow.md"),
    [
      "## seed",
      "",
      "```yaml",
      `- { repo: vndredev/vow, project: ${project}, syncInterval: 300 }`,
      "```",
      "",
    ].join("\n"),
    "utf8",
  );
  return dir;
}

test("readConfigProjectUrl extracts the project: URL from the studio config seed", () => {
  const dir = seedConfig(PROJECT_URL);
  try {
    expect(readConfigProjectUrl(dir)).toBe(PROJECT_URL);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("readConfigProjectUrl is absent when the config file does not exist", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vow-proj-nocfg-"));
  try {
    expect(readConfigProjectUrl(dir)).toBeUndefined();
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("resolveProjectId returns the explicit env id without touching the config (env wins)", () => {
  // A dir with NO config — if the env id is used, no file read is needed, so this never throws.
  const dir = mkdtempSync(path.join(tmpdir(), "vow-proj-env-"));
  try {
    expect(resolveProjectId(dir, "PVT_env")).toBe("PVT_env");
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("resolveProjectId is absent when neither the env nor a config is present (the genuine opt-out)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vow-proj-none-"));
  try {
    expect(resolveProjectId(dir, NONE)).toBeUndefined();
    expect(resolveProjectId(dir, "")).toBeUndefined();
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
