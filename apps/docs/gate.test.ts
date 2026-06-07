import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runGate } from "@vow/gate";
import { expect, test } from "vite-plus/test";

const root = dirname(fileURLToPath(import.meta.url));

// The scenario-coverage gate for the docs app: generate, then prove every promised scenario has a test.
test("scenario-coverage: every promised scenario in the docs app has a matching test", () => {
  const { uncovered } = runGate({
    vowDir: join(root, "app"),
    outDir: join(root, ".generated"),
    testRoots: [join(root, "app"), join(root, ".generated")],
  });
  expect(uncovered).toEqual([]);
});
