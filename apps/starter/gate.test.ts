import { expect, test } from "vite-plus/test";
import path from "node:path";
import { runGate } from "@vow/gate";

const root = import.meta.dirname;

// The scenario-coverage gate for this app: generate, then prove every promised scenario has a test.
test("scenario-coverage: every promised scenario in the app has a matching test", () => {
  const { uncovered } = runGate({
    outDir: path.join(root, ".generated"),
    testRoots: [path.join(root, "app"), path.join(root, ".generated")],
    vowDir: path.join(root, "app"),
  });
  expect(uncovered).toEqual([]);
});
