import type { Frame, Step, StepFn, Tok } from "./types.ts";
import type { UiNode } from "@vow/component";
import { defined } from "./maybe.ts";

/** Push one or more nodes into the current sink. */
export const pushStep = (...nodes: readonly UiNode[]): Step => ({ kind: "push", nodes });

/** Open a frame (its built node flows into the parent sink on the matching close). */
export const openStep = (frame: Frame): Step => ({ frame, kind: "open" });

/** Push a code node and, when inside a `::: code-group`, record its `[label]` on that frame. */
export const fenceStep = (node: UiNode, label: string): Step => ({ kind: "fence", label, node });

/** Close the top frame. */
export const CLOSE: Step = { kind: "close" };

/** A token this walk ignores (e.g. a hidden tight-list paragraph). */
export const NOOP: Step = { kind: "noop" };

/** One open frame plus the walk-owned accumulators for its children and (code-group) fence labels. */
interface Level {
  readonly frame: Frame;
  readonly kids: UiNode[];
  readonly labels: string[];
}

/** The frame stack feeding a document root — the only mutable state in the walk. */
class Stack {
  private readonly root: UiNode[] = [];
  private readonly levels: Level[] = [];

  /** The current sink — the top level's kids, or the document root. */
  private sink(): UiNode[] {
    return this.levels.at(-1)?.kids ?? this.root;
  }

  /** Append nodes to the current sink. */
  public push(nodes: readonly UiNode[]): void {
    this.sink().push(...nodes);
  }

  /** Append a code node, recording its label when the open frame is a code-group. */
  public fence(node: UiNode, label: string): void {
    const top = this.levels.at(-1);
    if (defined(top) && top.frame.collectsLabels === true) {
      top.labels.push(label);
    }
    this.sink().push(node);
  }

  /** Open a new level for `frame`. */
  public open(frame: Frame): void {
    this.levels.push({ frame, kids: [], labels: [] });
  }

  /** Close the top level, building its node into the parent sink. */
  public close(): void {
    const top = this.levels.pop();
    if (top) {
      this.sink().push(top.frame.build(top.kids, top.labels));
    }
  }

  /** Apply one step to the stack. */
  public apply(step: Step): void {
    if (step.kind === "push") {
      this.push(step.nodes);
    } else if (step.kind === "fence") {
      this.fence(step.node, step.label);
    } else if (step.kind === "open") {
      this.open(step.frame);
    } else if (step.kind === "close") {
      this.close();
    }
  }

  /** The assembled nodes, after the whole token stream has been walked. */
  public nodes(): UiNode[] {
    return this.root;
  }
}

/**
 * Run a token stream through a per-token `step` into a flat node list. The frame stack — the only mutable
 * state — lives in `Stack`, so each `step` stays a pure `(token) → Step`.
 */
export function runWalk(tokens: readonly Tok[], step: StepFn): UiNode[] {
  const stack = new Stack();
  for (const token of tokens) {
    stack.apply(step(token));
  }
  return stack.nodes();
}
