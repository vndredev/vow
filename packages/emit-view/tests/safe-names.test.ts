import { expect, test } from "vite-plus/test";
import { requireSafeNames } from "../src/index.ts";

/*
 * The `add_view` MCP seam validator (#305): a `## view` node carries raw author/LLM keys that land in
 * expression/name position — a slice `filter` key becomes an object-literal key, a primitive prop name
 * becomes a rendered attribute name. `requireSafeNames` is the pre-write gate that rejects a breakout
 * key synchronously (so `add_view` fails at the seam, not the next build), mirroring the SelectOption
 * defense-in-depth (#283/#299). These tests pin both sinks plus the recursion into primitive children.
 */

/** One `## view` node — the `{ type, value }` shape `requireSafeNames` walks. */
interface Node {
  readonly type: string;
  readonly value: unknown;
}

/** Run `requireSafeNames` in a void-bodied arrow (no shorthand void return) so `toThrow` can assert. */
function run(view: readonly Node[]): () => void {
  return (): void => {
    requireSafeNames(view);
  };
}

test("requireSafeNames rejects a hostile slice filter key (object-literal-key sink)", () => {
  const view: readonly Node[] = [
    { type: "list", value: { filter: { "a }; alert(1); ({": "x" }, of: "task" } },
  ];
  expect(run(view)).toThrow(/not a safe identifier/u);
});

test("requireSafeNames rejects a hostile primitive prop name (attribute-name sink)", () => {
  const view: readonly Node[] = [{ type: "button", value: { 'class="x" @click': "doEvil()" } }];
  expect(run(view)).toThrow(/not a safe attribute name/u);
});

test("requireSafeNames recurses into a primitive's children (a nested breakout is still caught)", () => {
  const view: readonly Node[] = [
    { type: "stack", value: { children: [{ button: { 'class="x" @click': "doEvil()" } }] } },
  ];
  expect(run(view)).toThrow(/not a safe attribute name/u);
});

test("requireSafeNames accepts a legitimate view (valid field-name filter + valid prop names)", () => {
  const view: readonly Node[] = [
    { type: "board", value: { by: "status", filter: { priority: "high" }, of: "task" } },
    { type: "button", value: { "aria-label": "Add", variant: "primary" } },
  ];
  expect(run(view)).not.toThrow();
});
