/**
 * The layer-DAG gate — the 4-layer architecture made mechanical. Every `@vow/*` package sits in one
 * layer; a dependency may point DOWN (a strictly lower layer) or stay within its own, never UP. The audit
 * found the DAG acyclic today but only by convention — nothing forbids a future cross-layer or cyclic
 * import. This turns the architecture into a build failure: an upward edge, an unassigned package, or a
 * cycle fails. Pure (the caller reads the `package.json` deps), so the rule is unit-testable.
 */

/** The 4 layers, lowest first: L0 foundation → L1 emit → L2 composition → L3 orchestration. A package may
 *  depend on its own layer or a lower one. A package missing here is a violation — a new one must declare. */
const LAYERS: readonly (readonly string[])[] = [
  ["component", "core", "db", "headless", "icons", "observability", "plan", "theme"],
  ["emit-bind", "emit-entity", "emit-primitive", "emit-view", "layout"],
  ["docs", "markdown", "router", "shell", "store"],
  ["agent", "cli", "gate", "mcp", "vite-plugin"],
];

/** The layer index of a package, or -1 when it isn't assigned a layer. */
function layerOf(pkg: string): number {
  return LAYERS.findIndex((layer) => layer.includes(pkg));
}

/** The `@vow` dependency graph: each package paired with the `@vow` packages it depends on (no prefix). */
export type DepGraph = readonly (readonly [string, readonly string[]])[];

/** A broken edge in the DAG: the importer, the imported package, and why it breaks. */
export interface LayerViolation {
  readonly from: string;
  readonly reason: string;
  readonly to: string;
}

/** Whether the graph has a cycle — DFS with a shared closed-set + a per-path open-set (a node re-entered
 *  while still open closes a loop). */
function hasCycle(graph: DepGraph): boolean {
  const deps = new Map(graph);
  const closed = new Set<string>();
  const open = new Set<string>();
  const walk = (node: string): boolean => {
    if (closed.has(node)) {
      return false;
    }
    if (open.has(node)) {
      return true;
    }
    open.add(node);
    const cyclic = (deps.get(node) ?? []).some((next) => walk(next));
    open.delete(node);
    closed.add(node);
    return cyclic;
  };
  return [...deps.keys()].some((node) => walk(node));
}

/** The upward + unassigned violations for one package and its deps. */
function edgeViolations(from: string, deps: readonly string[]): LayerViolation[] {
  const fromLayer = layerOf(from);
  const out: LayerViolation[] = [];
  if (fromLayer < 0) {
    out.push({ from, reason: "unassigned layer", to: from });
  }
  for (const to of deps) {
    const toLayer = layerOf(to);
    if (fromLayer >= 0 && toLayer > fromLayer) {
      out.push({ from, reason: `upward import L${fromLayer} -> L${toLayer}`, to });
    }
  }
  return out;
}

/**
 * Every DAG break in the `@vow` dependency graph: an UPWARD import (a lower layer depending on a higher
 * one), an UNASSIGNED package (a new package must declare its layer), and a CYCLE. Empty means the graph
 * is the clean 4-layer DAG the architecture claims.
 */
export function layerViolations(graph: DepGraph): LayerViolation[] {
  const edges = graph.flatMap(([from, deps]) => edgeViolations(from, deps));
  if (hasCycle(graph)) {
    return [...edges, { from: "graph", reason: "dependency cycle", to: "graph" }];
  }
  return edges;
}
