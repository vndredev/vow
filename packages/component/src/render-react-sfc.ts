import type { Component } from "./model.ts";
import { renderImport } from "./render-script.ts";
import { renderReactView } from "./render-react.ts";

/**
 * The React adapter SHELL — render a canonical `Component` into a React SFC (`.tsx`) string. The
 * sibling of `renderVueSfc` (render-vue.ts): it renders the component's imports, then wraps the view
 * (via the proven `renderReactView`, render-react.ts) in a default-exported function component. Output
 * is **byte-stable** — pinned by an equality test, so a render change is a red test, not silent drift.
 *
 * Scope is STATELESS presentational components only. A `setup`, `props`, or `events` section needs the
 * Vue-composable to React-runtime translation that stays the strategic follow-up of #101; rather than
 * render half a feature, such a component throws loudly here.
 */

/** Indent depth of the view: one level for the function body, one for the `return (` block. */
const VIEW_DEPTH = 2;

/** True when the component carries state the React shell does not yet translate (setup/props/events). */
function isStateful(component: Component): boolean {
  const setup = component.setup ?? [];
  const props = component.props ?? [];
  const events = component.events ?? [];
  return setup.length > 0 || props.length > 0 || events.length > 0;
}

/** Render a stateless `Component` to a React SFC string; throw on any stateful section (#101 follow-up). */
export function renderReactSfc(component: Component): string {
  if (isStateful(component)) {
    throw new Error(
      "#101 follow-up: React setup/props translation — renderReactSfc handles stateless components only",
    );
  }
  return [
    ...(component.imports ?? []).map((decl) => renderImport(decl)),
    `export default function ${component.name}() {`,
    `  return (`,
    renderReactView(component.view, VIEW_DEPTH),
    `  );`,
    `}`,
    ``,
  ].join("\n");
}
