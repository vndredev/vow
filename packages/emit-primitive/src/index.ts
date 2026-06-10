/**
 * The primitive emitter — generates vow's thin framework adapters over the `@vow/headless` primitives.
 *
 * The logic AND the a11y are proven in the core (tested against the DOM, framework-free). Each adapter
 * binds the framework's reactivity and spreads the props — it carries only `class` + the core's `data-*`
 * state hooks, no logic of its own. vow's own base look lives in a swappable theme (`@vow/theme`) that
 * targets those hooks, so the look can be re-skinned without touching the adapter. Adapters are described
 * as canonical `Component`s and rendered by the Vue adapter (`renderVueSfc`), so React/Solid become
 * further adapters over the same model — see `@vow/component`.
 *
 * The adapters are grouped by concern: `interactive` (form controls over the core), `overlay` (the
 * document-touching dialog/select), `structural` (button/badge/field/callout — their own props), and
 * `layout` (the table/card/stats part families). This module re-exports them + the closed registry.
 */

import { emitBadgeSfc, emitButtonSfc, emitCalloutSfc, emitFieldSfc } from "./structural.ts";
import {
  emitCardBodySfc,
  emitCardHeaderSfc,
  emitCardSfc,
  emitStatSfc,
  emitStatsSfc,
  emitTableCellSfc,
  emitTableHeadSfc,
  emitTableRowSfc,
  emitTableSfc,
} from "./layout.ts";
import {
  emitCheckboxSfc,
  emitCollapsibleSfc,
  emitRadioGroupSfc,
  emitSwitchSfc,
  emitTabsSfc,
} from "./interactive.ts";
import { emitDialogSfc, emitSelectSfc } from "./overlay.ts";

export {
  emitCheckboxSfc,
  emitCollapsibleSfc,
  emitRadioGroupSfc,
  emitSwitchSfc,
  emitTabsSfc,
} from "./interactive.ts";
export {
  emitCardBodySfc,
  emitCardHeaderSfc,
  emitCardSfc,
  emitStatSfc,
  emitStatsSfc,
  emitTableCellSfc,
  emitTableHeadSfc,
  emitTableRowSfc,
  emitTableSfc,
} from "./layout.ts";
export { emitDialogSfc, emitSelectSfc } from "./overlay.ts";
export { emitBadgeSfc, emitButtonSfc, emitCalloutSfc, emitFieldSfc } from "./structural.ts";

/**
 * The closed primitive registry — PascalCase name → its Vue SFC emitter. The single source of vow's
 * primitive vocabulary: `emit-view` validates `## view` references against these names, the vite-plugin
 * materialises each referenced adapter into `.generated/` on demand, and the docs reuse it for prose.
 */
export const PRIMITIVE_ADAPTERS: Record<string, () => string> = {
  Badge: emitBadgeSfc,
  Button: emitButtonSfc,
  Callout: emitCalloutSfc,
  Card: emitCardSfc,
  CardBody: emitCardBodySfc,
  CardHeader: emitCardHeaderSfc,
  Checkbox: emitCheckboxSfc,
  Collapsible: emitCollapsibleSfc,
  Dialog: emitDialogSfc,
  Field: emitFieldSfc,
  RadioGroup: emitRadioGroupSfc,
  Select: emitSelectSfc,
  Stat: emitStatSfc,
  Stats: emitStatsSfc,
  Switch: emitSwitchSfc,
  Table: emitTableSfc,
  TableCell: emitTableCellSfc,
  TableHead: emitTableHeadSfc,
  TableRow: emitTableRowSfc,
  Tabs: emitTabsSfc,
};
