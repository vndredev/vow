import { expect, test } from "vite-plus/test";
import { graphqlArgs } from "../src/project.ts";

test("graphqlArgs binds each variable via -f, never interpolating it into the query", () => {
  const args = graphqlArgs("query($pid:ID!){node(id:$pid){number}}", [
    { name: "pid", value: "PVT_x'; injected" },
  ]);
  // The value rides as a bound -f field, and never appears in the query text — so it can't inject.
  expect(args).toContain("pid=PVT_x'; injected");
  expect(args.some((arg) => arg.startsWith("query=") && arg.includes("injected"))).toBe(false);
  expect(args.some((arg) => arg.startsWith("query=") && arg.includes("$pid"))).toBe(true);
});
