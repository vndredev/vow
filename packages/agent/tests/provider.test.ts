import { codex, gemini, providerFor } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const task = { branch: "vow/issue-1", cwd: "/wt", plan: "do the thing", title: "t" };

test("providerFor resolves codex + gemini; each maps the plan to its headless CLI", () => {
  expect(providerFor("codex")).toBe(codex);
  expect(providerFor("gemini")).toBe(gemini);
  expect(providerFor("nope")).toBeUndefined();
  expect(codex.command(task).bin).toBe("codex");
  expect(codex.command(task).args).toContain("do the thing");
  expect(gemini.command(task).args).toContain("--yolo");
});
