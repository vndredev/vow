import type { Component, UiNode } from "./types.ts";
import { bound, comp, el, txt } from "./helpers.ts";
import { emptyStates } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";

/**
 * The three live issue-plan SFCs (`useIssues`, gh-direct) — table, board and roadmap. Each is a fixed
 * component the plugin materialises (`map-node.ts`'s `issues:` node points at one). They share the
 * status → Badge-variant lines below and read `/__vow/issues` live (no baked data, unlike the timeline).
 * Each is a canonical `Component` rendered through @vow/component — framework-neutral, never raw Vue.
 */

/**
 * The status → Badge-variant lines the three issue SFCs share (mirrors @vow/observability's
 * STATUS_VARIANT; the SFCs run in the browser, so they inline it rather than import the node helper).
 * One source — change the mapping here, all three layouts follow.
 */
export const ISSUE_VARIANT_LINES = [
  `const tone = (s: string): "neutral" | "accent" | "success" =>`,
  `  s === "done" ? "success" : s === "doing" ? "accent" : "neutral";`,
];

/** The shared setup line every issue SFC opens with — the live plan, its fetch state, and the actions. */
export const ISSUE_SETUP_LINE = `const { items, state, closeIssue, reopenIssue, startWork } = useIssues();`;

/** The three empty-state messages every issue layout shares — only one shows, keyed off `state`/`items`.
 *  "Loading the plan…" while the first fetch is in flight, "Couldn't reach GitHub" when it failed, and the
 *  entity-list "Nothing here yet." when the plan is genuinely empty. */
function issueEmptyStates(): readonly UiNode[] {
  return emptyStates("items.length", {
    empty: "Nothing here yet.",
    failed: "Couldn't reach GitHub",
    loading: "Loading the plan…",
  });
}

/** Add the `items.length > 0` guard to a layout node so it renders only when the plan has items — its own
 *  `cond` attr, alongside the layout's static class. */
function guardedLayout(layout: UiNode): UiNode {
  if (layout.kind !== "element") {
    return layout;
  }
  return {
    ...layout,
    attrs: [...layout.attrs, { expr: "items.length > 0", kind: "cond", type: "if" }],
  };
}

/** Wrap a layout's view tree in a `<section>` that shows the layout only when the plan has items, else one
 *  of the shared status messages — so the studio's first screen is never a bare header. */
export function withEmptyStates(layout: UiNode): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-issues" }],
    children: [guardedLayout(layout), ...issueEmptyStates()],
    kind: "element",
    tag: "section",
  };
}

/**
 * The close/reopen action button the three issue layouts share — `Reopen` when the issue is done (closed),
 * else `Close`, keyed off the live `it.status`. It calls `closeIssue`/`reopenIssue` from `useIssues`, which
 * POST through the same dev seam the agent's MCP `close_issue` uses — one path to GitHub for user + agent.
 */
function issueActionButton(): UiNode {
  return comp(
    "Button",
    [
      bound("label", `it.status === 'done' ? 'Reopen' : 'Close'`),
      { kind: "static", name: "size", value: "sm" },
      { kind: "static", name: "variant", value: "ghost" },
      {
        expr: `it.status === 'done' ? reopenIssue(it.issue.number) : closeIssue(it.issue.number)`,
        kind: "event",
        name: "click",
      },
    ],
    [],
  );
}

/**
 * The start-work button the three issue layouts share — the human's one signal to begin an issue. It calls
 * `startWork` from `useIssues`, which POSTs the start-work signal to `/__vow/agent`; the dev server then
 * dispatches an agent session (`vow agent run <n>`). Shown only on an issue not yet `done` AND not already
 * carrying a session — once a run is live (`it.session`, an open PR redeeming it), the accent is "Watch run",
 * not a second "Start work" that would dispatch a duplicate agent onto the same issue. So it appears on a
 * planned issue (or a `doing` one whose run has gone — a re-signal), never beside a live run. A compact
 * `default · sm` — the Vermilion accent IS the one intent per card (start an agent); the quiet
 * `Close`/`Reopen` sit beside it. Status stays derived — the PR makes it `doing`.
 */
function startWorkButton(): UiNode {
  return comp(
    "Button",
    [
      { expr: "it.status !== 'done' && !it.session", kind: "cond", type: "if" },
      { kind: "static", name: "label", value: "Start work" },
      { kind: "static", name: "size", value: "sm" },
      { kind: "static", name: "tone", value: "accent" },
      { kind: "static", name: "variant", value: "solid" },
      { expr: "startWork(it.issue.number)", kind: "event", name: "click" },
    ],
    [],
  );
}

/**
 * The agent-session link the three issue layouts share — present only when the issue carries a `session`
 * (an open PR redeeming it); an external link to the run, opened in a new tab so the human can watch it.
 */
function issueSessionLink(): UiNode {
  return {
    attrs: [
      { expr: "it.session", kind: "cond", type: "if" },
      { kind: "static", name: "class", value: "vow-issue-session" },
      bound("href", "it.session.url"),
      { kind: "static", name: "rel", value: "noreferrer" },
      { kind: "static", name: "target", value: "_blank" },
    ],
    children: [txt("Watch run #"), { expr: "it.session.number", kind: "interp" }],
    kind: "element",
    tag: "a",
  };
}

/** A status `<Badge>` chip — `:label` + the shared `tone(...)` mapping (a soft badge, tone from meaning). */
function statusBadge(statusExpr: string): UiNode {
  return comp("Badge", [bound("label", statusExpr), bound("tone", `tone(${statusExpr})`)], []);
}

/** A static-class element node with the given tag and children. */
export function classed(tag: string, cls: string, children: readonly UiNode[]): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: cls }],
    children: [...children],
    kind: "element",
    tag,
  };
}

/** The actions cell the issue layouts share — start-work, close/reopen and the session link grouped so they
 *  travel as one unit (the card's CSS pushes the group to the trailing edge), never scattered. */
function issueActions(): UiNode {
  return classed("div", "vow-issue-actions", [
    startWorkButton(),
    issueActionButton(),
    issueSessionLink(),
  ]);
}

/** The `<thead>` of the issue table — one head cell per column. */
function tableHead(): UiNode {
  return el("thead", [
    el(
      "tr",
      ["#", "Title", "Status", "Labels", "Assignee", "Actions"].map((label) =>
        classed("th", "vow-table__head", [txt(label)]),
      ),
    ),
  ]);
}

/** A neutral `<Badge>` per label, looped over `it.issue.labels` — shared by the table cell and the board
 *  card so the two layouts render an issue's labels the same way. */
function labelBadges(): UiNode {
  return {
    attrs: [bound("label", "l"), { kind: "static", name: "variant", value: "outline" }],
    children: [],
    for: { as: "l", each: "it.issue.labels", key: "l" },
    kind: "component",
    name: "Badge",
  };
}

/** The labels cell — a neutral `<Badge>` per label. The flex wrap lives on an inner `<div>`, NOT the
 *  `<td>`: a `display:flex` table-cell doesn't stretch to the row height, so its bottom border sits high
 *  and the row separators slip. The `<td>` stays a real table-cell; the div owns the wrapping. */
function labelsCell(): UiNode {
  return classed("td", "vow-table__cell", [
    classed("div", "vow-issue-table__labels", [labelBadges()]),
  ]);
}

/** A single data row of the issue table. */
function tableRow(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-table__row" }],
    children: [
      classed("td", "vow-table__cell vow-issue-table__num", [
        { expr: "it.issue.number", kind: "interp" },
      ]),
      classed("td", "vow-table__cell", [{ expr: "it.issue.title", kind: "interp" }]),
      classed("td", "vow-table__cell", [statusBadge("it.status")]),
      labelsCell(),
      classed("td", "vow-table__cell", [{ expr: `it.issue.assignees.join(", ")`, kind: "interp" }]),
      classed("td", "vow-table__cell", [
        startWorkButton(),
        issueActionButton(),
        issueSessionLink(),
      ]),
    ],
    for: { as: "it", each: "items", key: "it.issue.number" },
    kind: "element",
    tag: "tr",
  };
}

/**
 * The issue-table component — a fixed `<VowIssueTable>` reading the live issue plan (`useIssues`,
 * gh-direct). No baked data (unlike the timeline): it fetches `/__vow/issues` and polls. Mirrors a
 * GitHub Projects Table view: number · title · status · labels · assignee.
 */
export function emitIssueTableSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the GitHub issue plan as a table, read live from /__vow/issues. Do not edit.",
    ],
    imports: [
      { from: "@vow/store", names: ["useIssues"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Button", from: "./Button.vue" },
    ],
    name: "VowIssueTable",
    setup: [ISSUE_SETUP_LINE, ...ISSUE_VARIANT_LINES],
    view: withEmptyStates(
      classed("table", "vow-table vow-issue-table", [tableHead(), el("tbody", [tableRow()])]),
    ),
  };
  return renderVueSfc(component);
}

/** A board column header — the status Badge + a count. */
function boardColumnHead(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-board__col-head" }],
    children: [
      statusBadge("col.status"),
      {
        attrs: [{ kind: "static", name: "class", value: "vow-board__count" }],
        children: [{ expr: "col.items.length", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
    ],
    kind: "element",
    tag: "div",
  };
}

/** The board card's labels row — the shared per-label Badge loop, shown only when the issue has labels so
 *  a card with none stays clean. */
function boardCardLabels(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-issue-board__labels" },
      { expr: "it.issue.labels.length > 0", kind: "cond", type: "if" },
    ],
    children: [labelBadges()],
    kind: "element",
    tag: "div",
  };
}

/** The board card's assignee chip — the comma-joined assignees, shown only when the issue has any so a
 *  card with none stays clean. Mirrors the table's assignee cell. */
function boardCardAssignees(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-issue-board__assignee" },
      { expr: "it.issue.assignees.length > 0", kind: "cond", type: "if" },
    ],
    children: [{ expr: `it.issue.assignees.join(", ")`, kind: "interp" }],
    kind: "element",
    tag: "span",
  };
}

/** A board card per issue in a column — the title leads (the content), then any labels, then a meta footer:
 *  the number + assignee grouped at the start, the actions trailing. Same hierarchy as a roadmap item. */
function boardCard(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-board__card" }],
    children: [
      {
        attrs: [{ kind: "static", name: "class", value: "vow-issue-board__title" }],
        children: [{ expr: "it.issue.title", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
      boardCardLabels(),
      classed("div", "vow-issue-board__meta", [
        {
          attrs: [{ kind: "static", name: "class", value: "vow-issue-board__num" }],
          children: [txt("#"), { expr: "it.issue.number", kind: "interp" }],
          kind: "element",
          tag: "span",
        },
        boardCardAssignees(),
        issueActions(),
      ]),
    ],
    for: { as: "it", each: "col.items", key: "it.issue.number" },
    kind: "element",
    tag: "article",
  };
}

/** The issue-board view tree — a column per derived status, each holding its cards. */
function boardView(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-board vow-issue-board" }],
    children: [
      {
        attrs: [{ kind: "static", name: "class", value: "vow-board__col" }],
        children: [boardColumnHead(), boardCard()],
        for: { as: "col", each: "grouped", key: "col.status" },
        kind: "element",
        tag: "div",
      },
    ],
    kind: "element",
    tag: "div",
  };
}

/**
 * The issue-board component — a fixed `<VowIssueBoard>` reading the live issue plan (`useIssues`,
 * gh-direct) as a kanban by derived status. Mirrors a GitHub Projects Board view; reuses the entity
 * board's look (`.vow-board`).
 */
export function emitIssueBoardSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the GitHub issue plan as a board, read live from /__vow/issues. Do not edit.",
    ],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["useIssues"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Button", from: "./Button.vue" },
    ],
    name: "VowIssueBoard",
    setup: [
      ISSUE_SETUP_LINE,
      `const columns = ["planned", "doing", "done"] as const;`,
      ...ISSUE_VARIANT_LINES,
      `const grouped = computed(() =>`,
      `  columns.map((c) => ({ status: c, items: items.filter((it) => it.status === c) })),`,
      `);`,
    ],
    view: withEmptyStates(boardView()),
  };
  return renderVueSfc(component);
}

const ROADMAP_SCRIPT = [
  ISSUE_SETUP_LINE,
  ...ISSUE_VARIANT_LINES,
  `interface Phase { title: string; due: string; dueAt: number; open: IssueItem[]; done: IssueItem[] }`,
  `const phases = computed(() => {`,
  `  const by = new Map<string, Phase>();`,
  `  for (const it of items) {`,
  `    const m = it.issue.milestone;`,
  `    const title = m?.title ?? "No milestone";`,
  `    let phase = by.get(title);`,
  `    if (phase === undefined) {`,
  `      const dueOn = m?.dueOn ?? "";`,
  `      const dueAt = dueOn ? Date.parse(dueOn) : Number.POSITIVE_INFINITY; // undated phases sort last`,
  `      phase = { title, due: dueOn.slice(0, 10), dueAt, open: [], done: [] };`,
  `      by.set(title, phase);`,
  `    }`,
  `    // The open work leads each phase; the done work collapses into the "shipped" disclosure (proof).`,
  `    if (it.status === "done") { phase.done.push(it); } else { phase.open.push(it); }`,
  `  }`,
  `  return [...by.values()].sort((a, b) => a.dueAt - b.dueAt); // earliest phase first`,
  `});`,
];

/** One roadmap item `<li>` — the title leads (the content), then a meta footer: the number + status grouped
 *  at the start, the actions trailing. `each` is the source list (a phase's open or shipped items). */
function roadmapItem(each: string): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-roadmap__item" }],
    children: [
      classed("span", "vow-roadmap__title", [{ expr: "it.issue.title", kind: "interp" }]),
      classed("div", "vow-roadmap__meta", [
        classed("span", "vow-roadmap__num", [
          txt("#"),
          { expr: "it.issue.number", kind: "interp" },
        ]),
        statusBadge("it.status"),
        issueActions(),
      ]),
    ],
    for: { as: "it", each, key: "it.issue.number" },
    kind: "element",
    tag: "li",
  };
}

/** A phase's open work — the `<ul>` of cards that lead the phase, shown only when it has open items. */
export function roadmapOpen(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-roadmap__items" },
      { expr: "p.open.length > 0", kind: "cond", type: "if" },
    ],
    children: [roadmapItem("p.open")],
    kind: "element",
    tag: "ul",
  };
}

/** A phase's shipped work — a native `<details>` that collapses the done cards behind a "✓ N shipped"
 *  disclosure (green = proof), shown only when the phase has done items. So a completed phase reads as one
 *  compact line, a mixed phase leads with its open cards and tucks the rest away. */
export function roadmapShipped(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-roadmap__shipped" },
      { expr: "p.done.length > 0", kind: "cond", type: "if" },
    ],
    children: [
      classed("summary", "vow-roadmap__shipped-head", [
        txt("✓ "),
        {
          expr: "p.done.length + (p.open.length > 0 ? ' more shipped' : ' shipped')",
          kind: "interp",
        },
      ]),
      {
        attrs: [{ kind: "static", name: "class", value: "vow-roadmap__items" }],
        children: [roadmapItem("p.done")],
        kind: "element",
        tag: "ul",
      },
    ],
    kind: "element",
    tag: "details",
  };
}

/** One roadmap phase `<section>` — its milestone heading + due date, then the open cards, then the
 *  collapsed shipped work. */
function roadmapPhase(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-roadmap__phase" }],
    children: [
      {
        attrs: [{ kind: "static", name: "class", value: "vow-roadmap__head" }],
        children: [
          {
            attrs: [{ kind: "static", name: "class", value: "vow-roadmap__milestone" }],
            children: [{ expr: "p.title", kind: "interp" }],
            kind: "element",
            tag: "h3",
          },
          {
            attrs: [
              { kind: "static", name: "class", value: "vow-roadmap__due" },
              { expr: "p.due", kind: "cond", type: "if" },
            ],
            children: [{ expr: "p.due", kind: "interp" }],
            kind: "element",
            tag: "span",
          },
        ],
        kind: "element",
        tag: "header",
      },
      roadmapOpen(),
      roadmapShipped(),
    ],
    for: { as: "p", each: "phases", key: "p.title" },
    kind: "element",
    tag: "section",
  };
}

/** The issue-roadmap view tree — a `<section>` per milestone phase, sorted by due date. */
function roadmapView(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-roadmap" }],
    children: [roadmapPhase()],
    kind: "element",
    tag: "div",
  };
}

/**
 * The issue-roadmap component — a fixed `<VowIssueRoadmap>` reading the live issue plan (`useIssues`,
 * gh-direct), grouped by **milestone** (the roadmap's phases). Mirrors a GitHub Projects Roadmap view.
 */
export function emitIssueRoadmapSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the GitHub issue plan as a roadmap: phases (milestones) on a timeline by due date. Do not edit.",
    ],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["type IssueItem", "useIssues"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Button", from: "./Button.vue" },
    ],
    name: "VowIssueRoadmap",
    setup: ROADMAP_SCRIPT,
    view: withEmptyStates(roadmapView()),
  };
  return renderVueSfc(component);
}
