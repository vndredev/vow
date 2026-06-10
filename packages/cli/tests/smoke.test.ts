import { expect, test } from "vite-plus/test";
import { findNodeLeaks } from "../src/smoke.ts";

// A fetcher over an in-memory module graph keyed by server path — the shape `vp dev` serves.
function fetcherFor(graph: Readonly<Record<string, string>>): (path: string) => Promise<string> {
  return async (path) => {
    const body = await Promise.resolve(graph[path] ?? "");
    return body;
  };
}

test("findNodeLeaks: a browser-safe graph yields no leaks", async () => {
  const leaks = await findNodeLeaks(
    "/.generated/main.ts",
    fetcherFor({
      "/.generated/main.ts": `import { defined } from "/@fs/core.ts";`,
      "/@fs/core.ts": `export const defined = (value) => value;`,
    }),
  );
  expect(leaks).toEqual([]);
});

test("findNodeLeaks: catches a node: builtin reaching the client graph", async () => {
  const leaks = await findNodeLeaks(
    "/.generated/main.ts",
    fetcherFor({
      "/.generated/main.ts": `import { defined } from "/@fs/core.ts";`,
      "/@fs/core.ts": `export { loadVows } from "/@fs/load.ts";`,
      "/@fs/load.ts": `import { existsSync } from "/@id/__vite-browser-external:node:fs";`,
    }),
  );
  expect(leaks).toEqual([{ from: "/@fs/load.ts", stub: "/@id/__vite-browser-external:node:fs" }]);
});

test("findNodeLeaks: visits each module once, so an import cycle terminates", async () => {
  const leaks = await findNodeLeaks(
    "/a.ts",
    fetcherFor({ "/a.ts": `import "/b.ts";`, "/b.ts": `import "/a.ts";` }),
  );
  expect(leaks).toEqual([]);
});
