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

test("graphqlArgs binds a typed var via -F (a real JSON Int), a string var via -f", () => {
  // An Int! variable MUST ride -F: gh's -f always sends a JSON string, which GitHub rejects for Int!.
  const args = graphqlArgs("query($login:String!,$number:Int!){x}", [
    { name: "login", value: "vndredev" },
    { name: "number", typed: true, value: "3" },
  ]);
  // The typed var precedes its flag; assert the flag right before each name=value pair.
  expect(args[args.indexOf("login=vndredev") - 1]).toBe("-f");
  expect(args[args.indexOf("number=3") - 1]).toBe("-F");
});
