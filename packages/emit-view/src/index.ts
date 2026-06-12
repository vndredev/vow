/**
 * Vow's view emitter — `emit view` made real.
 *
 * The package's public surface, re-exported from focused concern modules. Two kinds of output: a page
 * from a YAML `## view` (`emitView`) and read-only compositions over an entity (`emitEntityList`,
 * `emitEntityCards`, `emitEntityBoard`, `emitEntityStats`) emitted **on demand** when a view pulls one
 * in. Both are built as a canonical `Component` (`@vow/component`) and rendered by the Vue adapter
 * (`renderVueSfc`) — unstyled (class hooks only); React/Solid would reuse the same model. Plus the app
 * boot/routes/layout, the standalone `## form`, and the git/issue-plan SFCs the docs + app share.
 */

export { LAYOUT_EXPORT, LAYOUT_SUFFIX, ROUTES_EXPORT, ROUTES_SUFFIX } from "./boot-convention.ts";
export { VOW_ENV_DTS, emitAppLayout, emitAppRoutes, emitBoot } from "./boot.ts";
export type { RoutedPage, ShellSpec } from "./boot.ts";
export { emitEntityBoard } from "./entity-board.ts";
export { emitEntityCards } from "./entity-cards.ts";
export { type ListActions, emitEntityList } from "./entity-list.ts";
export { emitEntityStats } from "./entity-stats.ts";
export { fieldControl } from "./field-control.ts";
export { emitForm } from "./form.ts";
export { ISSUE_LAYOUTS, type IssueLayout, issueLayout } from "./issue-layout.ts";
export { emitIssueBoardSfc, emitIssueRoadmapSfc, emitIssueTableSfc } from "./issue-sfc.ts";
export {
  VIEW_NODE_TYPES,
  assertKnownViewType,
  knownViewType,
  requireSafeNames,
} from "./map-node.ts";
export {
  boardComponentName,
  cardsComponentName,
  statsComponentName,
  viewComponentName,
} from "./naming.ts";
export {
  type FieldRef,
  type ListRef,
  boardRefs,
  cardsRefs,
  issueLayouts,
  listedEntities,
  statsRefs,
  usesTimeline,
} from "./refs.ts";
export { emitTimelineSfc } from "./timeline.ts";
export {
  type RenderScenario,
  formProves,
  formScenarios,
  renderScenarios,
  viewProves,
} from "./view-scenarios.ts";
export { emitCompositionTest, emitFormTest, emitViewTest } from "./view-test.ts";
export { buildView, emitProse, emitView, referencedPrimitives } from "./view.ts";
