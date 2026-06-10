import { primitive } from "./define.ts";

/**
 * The structural layout primitives — the table, card and stats part families. None has a `@vow/headless`
 * core: each is a thin structural wrapper over a native element with only its `class` hook (a `<slot>`
 * for content, or a small value/label tree for a stat). They compose into data grids, panels and metric
 * rows; the theme styles each `.vow-*` part. vow's base look lives in a swappable theme (`@vow/theme`).
 */

// The table parts — structural primitives over native <table> elements (no headless; class hooks only).
// Composed (e.g. by an entity list) into a data grid; the theme styles `.vow-table` + its parts.

/** Generate the Vue table adapter — a structural data grid over native <table> (no headless core). */
export const emitTableSfc = primitive({
  doc: ["Generated table — a structural data grid over native <table> (no headless core)."],
  name: "Table",
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-table" }],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "table",
  },
});

/** Generate the Vue table-row adapter (<tr>) — structural, class hook only. */
export const emitTableRowSfc = primitive({
  doc: ["Generated table row (<tr>) — structural, class hook only."],
  name: "TableRow",
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-table__row" }],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "tr",
  },
});

/** Generate the Vue table-head adapter (<th>) — structural; the caller sets `scope` via fall-through. */
export const emitTableHeadSfc = primitive({
  doc: [
    "Generated table header cell (<th>) — structural; the caller sets `scope` via fall-through.",
  ],
  name: "TableHead",
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-table__head" }],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "th",
  },
});

/** Generate the Vue table-cell adapter (<td>) — structural, class hook only. */
export const emitTableCellSfc = primitive({
  doc: ["Generated table cell (<td>) — structural, class hook only."],
  name: "TableCell",
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-table__cell" }],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "td",
  },
});

// The card parts — structural primitives for a bordered content surface (no headless; class hooks only).
// Composed (Card > CardHeader + CardBody) by the `cards` view pattern + anywhere a record needs a panel.

/** Generate the Vue card adapter — a structural bordered content surface (no headless core). */
export const emitCardSfc = primitive({
  doc: ["Generated card — a structural bordered content surface (no headless core)."],
  name: "Card",
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-card" }],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
});

/** Generate the Vue card-header adapter — structural, class hook only (a title row + optional actions). */
export const emitCardHeaderSfc = primitive({
  doc: ["Generated card header — structural, class hook only (a title row + optional actions)."],
  name: "CardHeader",
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-card__header" }],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
});

/** Generate the Vue card-body adapter — structural, class hook only (the card's content). */
export const emitCardBodySfc = primitive({
  doc: ["Generated card body — structural, class hook only (the card's content)."],
  name: "CardBody",
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-card__body" }],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
});

// The stats parts — a metric tile (Stat: value + label) and a responsive container (Stats > Stat).

/** Generate the Vue stat adapter — a value + label metric tile (structural, no headless). */
export const emitStatSfc = primitive({
  doc: ["Generated stat tile — a value + label metric (structural, no headless)."],
  name: "Stat",
  props: [
    { name: "value", tsType: "string | number" },
    { name: "label", tsType: "string" },
  ],
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-stat" }],
    children: [
      {
        attrs: [{ kind: "static", name: "class", value: "vow-stat__value" }],
        children: [{ expr: "value", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
      {
        attrs: [{ kind: "static", name: "class", value: "vow-stat__label" }],
        children: [{ expr: "label", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
    ],
    kind: "element",
    tag: "div",
  },
});

/** Generate the Vue stats adapter — a responsive row of <Stat> tiles (structural). */
export const emitStatsSfc = primitive({
  doc: ["Generated stats container — a responsive row of <Stat> tiles (structural)."],
  name: "Stats",
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-stats" }],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
});
